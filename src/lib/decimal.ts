export function normalizeNonNegativeDecimal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;

  const input = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(input)) return null;

  const [whole, fraction] = input.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction?.replace(/0+$/, "");

  return normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
}

export function addDecimalStrings(left: string, right: string): string {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftDigits = `${leftWhole}${leftFraction.padEnd(scale, "0")}`;
  const rightDigits = `${rightWhole}${rightFraction.padEnd(scale, "0")}`;
  const width = Math.max(leftDigits.length, rightDigits.length);
  const paddedLeft = leftDigits.padStart(width, "0");
  const paddedRight = rightDigits.padStart(width, "0");
  let carry = 0;
  let sum = "";

  for (let index = width - 1; index >= 0; index -= 1) {
    const digitSum = Number(paddedLeft[index]) + Number(paddedRight[index]) + carry;
    sum = String(digitSum % 10) + sum;
    carry = Math.floor(digitSum / 10);
  }

  if (carry) sum = String(carry) + sum;
  sum = sum.padStart(scale + 1, "0");
  const whole = scale > 0 ? sum.slice(0, -scale) : sum;
  const fraction = scale > 0 ? sum.slice(-scale).replace(/0+$/, "") : "";
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");

  return fraction ? `${normalizedWhole}.${fraction}` : normalizedWhole;
}

export function sumDecimalStrings(values: unknown[]): string {
  return values.reduce<string>((total, value) => {
    const normalized = normalizeNonNegativeDecimal(value);
    return normalized === null ? total : addDecimalStrings(total, normalized);
  }, "0");
}
