import child_process from "node:child_process";
import { map_error, promisify_stream, is_template_string } from "./utils.js";


export class ProcessPromise extends Promise
{
    constructor(execOrContext)
    {
        // Other waiter
        if (execOrContext instanceof Function)
        {
            super(execOrContext)
            return;
        }

        // Root promise
        let res, rej;
        super((resolve, reject) => {
            res = resolve;
            rej = reject;
        });
        this.#resolve = res;
        this.#reject = rej;

        this.#ctx = execOrContext;

        // Setup ignore status flag
        this.#nothrow = this.#ctx.options.nothrow;
        
        // Delay execution until next tick so
        // client can adjust pipe, exit code etc...
        setImmediate(() => this.#spawn());
    }

    #ctx;
    #resolve;
    #reject;
    #child;
    #nothrow;
    #result = {
        status: null,
        stdout: "",
        stderr: "",
        signal: null,
    }

    #spawn()
    {
        // Already spawned?
        if (this.#child)
            return;

        // Create process
        this.#child = child_process.spawn(this.#ctx.cmd, this.#ctx.args, this.#ctx.opts);

        // Exit handler
        this.#child.on("exit", (status, signal) => {
            this.#result.status = status;
            this.#result.signal = signal;
            if (!this.#nothrow && status)
            {
                this.#reject(new Error(`command exited with non-zero status code (${status})`));
            }
            else
            {
                this.#resolve(this.#result);
            }
        });

        // Error handler
        this.#child.on("error", err => this.#reject(map_error(err, opts)));

        // stdio
        if (this.#child.stdout)
        {
            this.#child.stdout.on('data', (data) => {
                this.#result.stdout += data.toString(this.#ctx.opts.encoding);
            });
        }

        // stderr
        if (this.#child.stderr)
        {
            this.#child.stderr.on('data', (data) => {
                this.#result.stderr += data.toString(this.#ctx.opts.encoding);
            });
        }
    }

    get status()
    {
        this.#nothrow = true;
        return new Promise((resolve, reject) => {
            this
                .then((r) => resolve(r.status))
                .catch(reject);
        });
    }

    get stdin()
    {
        if (!this.#child)
        {
            this.#ctx.opts.stdio[0] = "pipe";
            this.#spawn();
        }
        else if (this.#ctx.opts.stdio[0] != "pipe")
        {
            throw new Error("Can't write to stdin, child process already started with different stdio configuration");
        }
        return this.#child.stdin;
    }

    get stdout()
    {
        this.#spawn();
        return this.#child.stdout;
    }

    get stderr()
    {
        this.#spawn();
        return this.#child.stderr;
    }

    pipe(destination, opts)
    {
        this.#spawn();

        if (typeof(destination) === 'string')
        {
            destination = this.#ctx.owner([destination]);
        }

        if (destination instanceof ProcessPromise)
        {
            let dest_in = destination.stdin;
            this.#child.stdout.pipe(dest_in, opts);
            return destination;
        }
        else
        {
            let dest = this.#child.stdout.pipe(destination, opts);
            return promisify_stream(dest);
            return dest;
        }
    }


}

