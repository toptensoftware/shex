﻿class Program
{
    static void Main(string[] args)
    {
        foreach (var a in args)
        {
            Console.WriteLine($"({a})");
        }
        Console.WriteLine();
    }
}
