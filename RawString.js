export class RawString
{
    constructor(value)
    {
        this.value = value;
    }

    static flatten(values)
    {
        if (!Array.isArray(values))
            values = [values];
    
        for (let i=0; i<values.length; i++)
        {
            let v = values[i];
            if (v instanceof RawString && Array.isArray(v.value))
            {
                values.splice(i, 1, ...v.value.map(x => new RawString(x)));
                i += v.value.length - 1;
            }
        }
        return values;
    }

}

