import { Decimal } from "decimal.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CalculateSchema } from "../types.js"

export interface CalculationResult {
    expression: string
    raw_result: string
    rounded_result: number
    rounded_result_text: string
    rounding: "ceil_2dp"
}

class ExpressionParser {
    private index = 0

    constructor(private readonly input: string) {}

    parse(): Decimal {
        this.skipWhitespace()
        if (this.isAtEnd()) {
            throw new Error("Expression cannot be empty")
        }

        const value = this.parseExpression()
        this.skipWhitespace()

        if (!this.isAtEnd()) {
            throw new Error(`Unexpected character '${this.peek()}' at position ${this.index}`)
        }

        if (!value.isFinite()) {
            throw new Error("Calculation result is not finite")
        }

        return value
    }

    private parseExpression(): Decimal {
        let value = this.parseTerm()

        while (true) {
            this.skipWhitespace()
            const operator = this.peek()

            if (operator === "+") {
                this.index++
                value = value.plus(this.parseTerm())
            } else if (operator === "-") {
                this.index++
                value = value.minus(this.parseTerm())
            } else {
                return value
            }
        }
    }

    private parseTerm(): Decimal {
        let value = this.parseFactor()

        while (true) {
            this.skipWhitespace()
            const operator = this.peek()

            if (operator === "*") {
                this.index++
                value = value.times(this.parseFactor())
            } else if (operator === "/") {
                this.index++
                const divisor = this.parseFactor()
                if (divisor.isZero()) {
                    throw new Error("Division by zero is not allowed")
                }
                value = value.div(divisor)
            } else {
                return value
            }
        }
    }

    private parseFactor(): Decimal {
        this.skipWhitespace()
        const char = this.peek()

        if (char === "-") {
            this.index++
            return this.parseFactor().negated()
        }

        if (char === "(") {
            this.index++
            this.skipWhitespace()
            if (this.peek() === ")") {
                throw new Error("Empty parentheses are not allowed")
            }

            const value = this.parseExpression()
            this.skipWhitespace()

            if (this.peek() !== ")") {
                throw new Error("Missing closing parenthesis")
            }

            this.index++
            return value
        }

        return this.parseNumber()
    }

    private parseNumber(): Decimal {
        this.skipWhitespace()
        const start = this.index
        let hasDigits = false

        while (this.isDigit(this.peek())) {
            hasDigits = true
            this.index++
        }

        if (this.peek() === ".") {
            this.index++
            while (this.isDigit(this.peek())) {
                hasDigits = true
                this.index++
            }
        }

        if (!hasDigits) {
            const found = this.isAtEnd() ? "end of expression" : `'${this.peek()}'`
            throw new Error(`Expected number at position ${start}, found ${found}`)
        }

        const raw = this.input.slice(start, this.index)
        return new Decimal(raw)
    }

    private skipWhitespace(): void {
        while (/\s/.test(this.peek())) {
            this.index++
        }
    }

    private peek(): string {
        return this.input[this.index] ?? ""
    }

    private isAtEnd(): boolean {
        return this.index >= this.input.length
    }

    private isDigit(char: string): boolean {
        return char >= "0" && char <= "9"
    }
}

export function calculateExpression(expression: string): CalculationResult {
    if (/[^0-9+\-*/().\s]/.test(expression)) {
        throw new Error("Expression contains unsupported characters")
    }

    const rawResult = new ExpressionParser(expression).parse()
    const rounded = rawResult.toDecimalPlaces(2, Decimal.ROUND_CEIL)

    return {
        expression,
        raw_result: rawResult.toString(),
        rounded_result: rounded.toNumber(),
        rounded_result_text: rounded.toFixed(2),
        rounding: "ceil_2dp",
    }
}

export function register(server: McpServer): void {
    server.registerTool(
        "calculate",
        {
            description:
                "Evaluates a clean arithmetic expression in one deterministic tool call. " +
                "Use this whenever an expense, tax, split bill, reimbursement, or other money-related workflow requires arithmetic before calling expense tools. " +
                "The agent must extract the expression from natural language first; raw messages are not accepted. " +
                "Allowed grammar: numbers, whitespace, +, -, *, /, parentheses, and unary minus. Percent shorthand is not supported; convert 6% tax to multiplication by 1.06. " +
                "Returns the raw decimal result plus a money-safe result rounded upward to 2 decimal places using ceil_2dp.",
            inputSchema: CalculateSchema.shape,
        },
        async (args) => {
            try {
                const { expression } = CalculateSchema.parse(args)
                const result = calculateExpression(expression)

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                }
            } catch (err) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
                        },
                    ],
                    isError: true,
                }
            }
        },
    )
}
