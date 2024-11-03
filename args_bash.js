import { RawString } from "./RawString.js";

// Format the arguments from a template literal
// into a set of arguments for the spawn
// Should return { cmd, args }
export function args_bash(strings, values)
{
    let cmd = "";
    for (let i=0; i<strings.length; i++)
    {
        cmd += strings[i];
        if (i< values.length)
        {
            let first = true;
            for (let v of RawString.flatten(values[i]))
            {
                if (first)
                    first = false;
                else
                    cmd += " ";

                if (v instanceof RawString)
                {
                    cmd += v.value;
                }
                else
                {
                    cmd += "$'";
                    cmd += v
                        .replace(/\\/g, "\\\\")
                        .replace(/'/g, "\\'")
                        .replace(/"/g, "\\\"")
                        .replace(/\n/g, "\\n")
                        .replace(/\r/g, "\\r")
                        .replace(/\t/g, "\\t")
                    cmd += "'";
                }
            }
        }
    }
    return {
        cmd,
        args: [],
    }
}