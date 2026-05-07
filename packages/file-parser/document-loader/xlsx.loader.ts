export async function xlsxLoader(buffer: Uint8Array | ArrayBuffer) {
  const { read, utils } = await import('xlsx');
  const workbook = read(buffer);
  return workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const csv = utils.sheet_to_csv(worksheet);
    return { pageContent: csv, metadata: { title: name } };
  });
}
