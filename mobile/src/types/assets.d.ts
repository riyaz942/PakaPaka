declare module '*.db' {
  const assetId: number;
  export default assetId;
}

declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}
