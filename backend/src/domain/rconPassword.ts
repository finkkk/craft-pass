export const minimumRconPasswordLength = 3;

export function hasMinimumRconPasswordLength(password: string) {
  return password.length >= minimumRconPasswordLength;
}
