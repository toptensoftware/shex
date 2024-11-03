import child_process from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import fse from 'fs-extra/esm'
import os from "node:os";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import fetch from "node-fetch-native";
import chalk from "chalk";
import { globby, globbySync } from "globby";
import which from "which";

import { ProcessPromise } from "./ProcessPromise.js";
import { RawString } from "./RawString.js";
import { map_error, is_template_string } from "./utils.js";
import { args_bash } from "./args_bash.js";
import { args_cmd } from "./args_cmd.js";
import { args_exec } from "./args_exec.js";

let fs_sync = {};
let fs_async = {};

for (let k of Object.keys(fs))
{
    if (k.endsWith("Sync"))
        fs_sync[k.substring(0, k.length - 4)] = fs[k];
}
Object.assign(fs_async, fsPromises);
for (let k of Object.keys(fse))
{
    if (k.endsWith("Sync"))
        fs_sync[k.substring(0, k.length - 4)] = fse[k];
    else
        fs_async[k] = fse[k];
}

function question(message)
{
    const rl = readline.createInterface({ input, output });
    return rl.question(message).finally(() => rl.close());
}

function sleep(period)
{
    return new Promise((resolve) => setTimeout(resolve, period));
}

function glob_sync(posix, pattern, options)
{
    if (!posix)
    {
        if (!Array.isArray(pattern))
            pattern = [pattern];
        pattern = pattern.map(x => x.replace(/\\/g, '/'));
        let result = globbySync(pattern, options);
        result = result.map(x => x.replace(/\//g, "\\"));
        return result;
    }
    else
    {
        return globbySync(pattern, options);
    }
}

async function glob_async(posix, pattern, options)
{
    if (!posix)
    {
        if (!Array.isArray(pattern))
            pattern = [pattern];
        pattern = pattern.map(x => x.replace(/\\/g, '/'));
        let result = await globby(pattern, options);
        result = result.map(x => x.replace(/\//g, "\\"));
        return result;
    }
    else
    {
        return await globby(pattern, options);
    }
}

function raw(value)
{
    return new RawString(value);
}

let imports = {
    os,
    fetch,
    question,
    sleep,
    chalk,
    raw,
}


export default function shex(options)
{
    if (!options)
        options = {};
    if (!options.env)
        options.env = {};
    if (!options.encoding)
        options.encoding = "utf8";


    function exec(args)
    {
        let opts = {
            encoding: options.encoding,
        };

        // Setup stdio  (make sure it's an array)
        // and make sure and source arrays are copied.
        if (options.stdio)
        {
            if (Array.isArray(options.stdio))
            {
                opts.stdio = [ ...options.stdio ];
            }
            else
            {
                opts.stdio = [ options.stdio, options.stdio, options.stdio ];
            }
        }
        else
        {
            opts.stdio = [ "inherit", "pipe", "pipe" ];
        }

        // Setup other options
        if (options.input)
        {
            opts.input = options.input;
            opts.stdio[0] = "pipe";
        }
        if (options.cwd)
            opts.cwd = options.cwd;
        if (options.env)
            opts.env = Object.assign(process.env, options.env);
        if (options.shell)
            opts.shell = options.shell;
        if (args.shell !== undefined)
            opts.shell = args.shell;

        if (options.async)
        {
            return new ProcessPromise({
                owner: shex,
                options,
                opts,
                cmd: args.cmd, 
                args: args.args,
            });
        }
        else
        {
            let r =  child_process.spawnSync(args.cmd, args.args, opts);

            // Launch errors always throw
            if (r.error)
                throw map_error(r.error, opts);

            // Status erros only throw if !disabled
            if (!options.nothrow)
            {
                if (r.status)
                    throw new Error(`command exited with non-zero status code (${r.status})`);
            }

            // Return result
            return {
                signal: r.signal,
                status: r.status,
                stdout: r.stdout,
                stderr: r.stderr,
            }
        }
    }

    function get_args_resolver()
    {
        if (options.shell === false)
            return args_exec;
        else if (isPosixMode())
            return args_bash;
        else
            return args_cmd;
    }

    function exec_interopolated()
    {
        let strings = arguments[0];
        let values = Array.from(arguments).slice(1);
        let args = get_args_resolver()(strings, values);
        return exec(args);
    }

    let shex = function()
    {
        // Is this a command exec?
        if (is_template_string([...arguments]))
        {
            return exec_interopolated(...arguments);
        }

        // New context options?
        if (typeof(arguments[0]) === 'object')
        {
            // Merge options
            let newOptions = merge_options(options, arguments[0]);

            // If the second arguments is a function
            // change our context's options, run the function
            // and then restore state
            if (arguments[1] instanceof Function)
            {
                let save = options;
                options = newOptions;
                try
                {
                    let result = arguments[1]();
                    if (result.then)
                    {
                        result.finally(() => options = save)
                    }
                    return result;
                }
                finally
                {
                    options = save;
                }
            }

            return context(newOptions);
        }
    }

    function copy_options(o)
    {
        let n = Object.assign({}, o);
        n.env = Object.assign({}, o.env);
        return n;
    }

    function merge_options(a, b)
    {
        // Copy options
        let n = Object.assign({}, a, b);

        // Copy and merge env
        n.env = Object.assign({}, a.env);
        if (b.env)
            Object.assign(n.env, b.env); 

        // Resolve cwd
        if (b.cwd)
            n.cwd = path.resolve(a.cwd ?? process.cwd() + "/", b.cwd);

        return n;
    }

    let stack = [];
    shex.push = function(opts)
    {
        stack.push(options);
        this.set(opts);
    }

    shex.pop = function()
    {
        options = stack.pop();
    }

    shex.set = function(opts)
    {
        if (!opts)
            opts = {};
        if (typeof(opts) === 'string')
            opts = { cwd: opts }
        options = merge_options(options, opts);
    }

    function isPosixMode()
    {
        if (os.platform() == "win32")
        {
            if (typeof(options.shell) === 'string')
                return options.shell.toLowerCase().indexOf("cmd.exe")<0;
            else
                return false;
        }
        return true;
    }

    shex.glob = function(pattern, opts)
    {
        if (options.async)
        {
            return glob_async(isPosixMode(), pattern, opts);
        }
        else
        {
            return glob_sync(isPosixMode(), pattern, opts);
        }
    }

    Object.defineProperty(shex, "path", {
        get() 
        {
            return isPosixMode() ? path.posix : path;
        }
    });

    Object.defineProperty(shex, "fs", {
        get() 
        {
            return options.async ? fs_async : fs_sync;
        }
    });

    Object.defineProperty(shex, "which", {
        get() 
        {
            return options.async ? which : which.sync;
        }
    });

    let stdin;
    Object.defineProperty(shex, "stdin", {
        get() 
        {   
            if (stdin !== undefined)
                return stdin;
            if (options.async)
            {
                return new Promise((resolve, reject) => {
                    fs.readFile(0, options.encoding, (err, data) => {
                        if (err)
                            reject(err);
                        else
                            return resolve(stdin = data);
                    });
                });
            }
            else
            {
                stdin = fs.readFileSync(0, options.encoding);
                return stdin;
            }
        }
    });

    Object.assign(shex, imports);
    return shex;
}