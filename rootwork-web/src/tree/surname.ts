/**
 * A spelling-tolerant key for a surname, so McGuinness, McGuiness and MacGuinness count as one family line.
 * Case, spaces, punctuation, Mac/Mc and doubled letters are ignored.
 */
export function surnameKey(value: string): string {
  const letters = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  const mc = letters.replace(/^mac(?=[a-z]{3,})/, "mc");
  return mc.replace(/([a-z])\1+/g, "$1");
}
