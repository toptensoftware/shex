import fs from "node:fs";

// Give a better reason for to ENOENT when cwd doesn't exist
export function map_error(error, opts)
{
    if (error.code == "ENOENT" && opts.cwd)
    {
        try
        {
            fs.statSync(opts.cwd);
        }
        catch
        {
            error.message += `: cwd: ${opts.cwd}`;
            return error;
        }
    }
    return error;
}


const old_pipe = Symbol();
export function promisify_stream(stream)
{
    // Install "then"
    stream.then = function(resolve, reject)
    {
        return new Promise((resolve2, reject2) => {
            stream.once('error', (e) => reject2(reject(e)));
            stream.once('finish', () => resolve2(resolve()));
        });
    }

    // Also promisify streams piped from this one
    stream[old_pipe] = stream.pipe;
    stream.pipe = function()
    {
        let dest = stream[old_pipe](...arguments);
        return promisify_stream(dest);
    }

}

export function is_template_string(args)
{
    return Array.isArray(args[0]) && args.slice(1).every(x => typeof(x) === 'string');
}