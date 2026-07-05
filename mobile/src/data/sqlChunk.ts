/**
 * Conservative bound for parameters per statement. SQLite's historical
 * SQLITE_MAX_VARIABLE_NUMBER default is 999; newer builds allow more, but the
 * limit is a compile-time flag we don't control, so chunk every IN (...) list.
 */
export const SQL_VARIABLE_LIMIT = 999;

/**
 * Splits values into chunks that fit within the SQLite bound-parameter limit.
 * `reservedParams` accounts for other `?` placeholders in the same statement.
 */
export function chunkForSqlVariables<T>(values: T[], reservedParams = 0): T[][] {
  const chunkSize = Math.max(1, SQL_VARIABLE_LIMIT - reservedParams);
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}
