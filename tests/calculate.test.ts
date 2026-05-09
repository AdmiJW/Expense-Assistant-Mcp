import { describe, expect, it } from "vitest"
import { calculateExpression } from "../src/tools/calculate.js"

describe("calculateExpression", () => {
    it("evaluates addition and subtraction", () => {
        expect(calculateExpression("11.5+2.3-1").raw_result).toBe("12.8")
    })

    it("honors multiplication and division precedence", () => {
        expect(calculateExpression("2+3*4-8/2").raw_result).toBe("10")
    })

    it("honors parentheses", () => {
        expect(calculateExpression("(2+3)*(4-1)").raw_result).toBe("15")
    })

    it("allows whitespace", () => {
        expect(calculateExpression("  1.5 + 2.25 \n * 2 ").raw_result).toBe("6")
    })

    it("supports unary minus", () => {
        expect(calculateExpression("-5 + 2 * -(3)").raw_result).toBe("-11")
    })

    it("calculates the tax example in one expression", () => {
        expect(calculateExpression("(11.5+2.3+9)*1.06")).toEqual({
            expression: "(11.5+2.3+9)*1.06",
            raw_result: "24.168",
            rounded_result: 24.17,
            rounded_result_text: "24.17",
            rounding: "ceil_2dp",
        })
    })

    it("rounds upward to 2 decimal places", () => {
        expect(calculateExpression("24.161").rounded_result_text).toBe("24.17")
        expect(calculateExpression("24.160").rounded_result_text).toBe("24.16")
        expect(calculateExpression("10/3").rounded_result_text).toBe("3.34")
    })

    it("preserves two decimal places in rounded_result_text", () => {
        const result = calculateExpression("24")
        expect(result.rounded_result).toBe(24)
        expect(result.rounded_result_text).toBe("24.00")
    })

    it("rejects unsupported characters", () => {
        expect(() => calculateExpression("1 + tax")).toThrow("unsupported characters")
        expect(() => calculateExpression("1,000 + 2")).toThrow("unsupported characters")
    })

    it("rejects malformed expressions", () => {
        expect(() => calculateExpression("")).toThrow("Expression cannot be empty")
        expect(() => calculateExpression("1++2")).toThrow("Expected number")
        expect(() => calculateExpression("1*(2+3")).toThrow("Missing closing parenthesis")
        expect(() => calculateExpression("()")).toThrow("Empty parentheses")
        expect(() => calculateExpression("1 2")).toThrow("Unexpected character")
    })

    it("rejects division by zero", () => {
        expect(() => calculateExpression("10/(3-3)")).toThrow("Division by zero")
    })
})
