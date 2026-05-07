export type Text2Vec = <T extends string | string[]>(
  value: T,
  collectionName: string,
) => Promise<T extends string ? number[] : number[][]>;
