export function getQdrantFile() {
  switch (`${process.platform}-${process.arch}` as const) {
    case 'win32-x64':
      return `qdrant-x86_64-pc-windows-msvc.zip
`;
    case 'linux-x64':
      return `qdrant-x86_64-unknown-linux-gnu.tar.gz`;

    default:
      break;
  }
  throw new Error('');
}
