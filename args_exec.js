import { RawString } from "./RawString.js";



function parseArgs(str)
{
    // Split command
    let args = [];
    let arg = "";
    let quoteKind = null;
    for (let i=0; i<str.length; i++)
    {
        // Backslash?
        if (str[i] == '\\')
        {
            i++;
            arg += str[i];
            i++;
            continue;
        }

        // Enter/leave quotes
        if (str[i] == '\"' || str[i] == '\'')
        {
            if (quoteKind)
            {
                if (quoteKind == str[i])
                {
                    quoteKind = null;
                    continue;
                }
            }
            else
            {
                quoteKind = str[i];
                continue;
            }
        }

        // Other characters
        if (!quoteKind && (str[i] == ' ' || str[i] == '\t'))
        {
            if (arg.length > 0)
            {
                args.push(arg);
                arg = "";
            }
        }
        else
        {
            arg += str[i];
        }
    }

    if (quoteKind)
        throw new Error("Invalid command: quotes around interpolated values are not supported");

    if (arg.length > 0)
        args.push(arg);

    return args;
}


// Format the arguments from a template literal
// into a set of arguments for the spawn
// Should return { cmd, args }
export function args_exec(strings, values)
{
    let args = [];
    let pending = "";
    for (let i=0; i<strings.length; i++)
    {
        pending += strings[i];

        let needSpace = false;
        if (i < values.length)
        {
            for (let v of RawString.flatten(values[i]))
            {
                if (v instanceof RawString)
                {
                    if (needSpace)
                        pending += " ";
                    pending += v.value;
                    needSpace = true;
                }
                else
                {
                    if (pending.length > 0)
                    {
                        args.push(...parseArgs(pending));
                        pending = "";
                    }
                    args.push(v);
                }
            }
        }
    }

    if (pending.length > 0)
        args.push(...parseArgs(pending));

    let cmd = args.shift();
    return { cmd, args }
}