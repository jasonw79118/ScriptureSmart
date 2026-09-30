import { Client, TablesDB, TablesDBIndexType } from 'node-appwrite';
// Run manually with a temporary server API key in the process environment.
const endpoint = process.env.APPWRITE_ENDPOINT;
const project = process.env.APPWRITE_PROJECT_ID;
const key = process.env.APPWRITE_API_KEY;
if (!endpoint || !project || !key)
  throw Error(
    'Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY in your terminal environment. Never use a VITE_ API secret.',
  );
const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(key),
);
const databaseId = 'scripturesmart',
  tableId = 'community';
async function create(action) {
  try {
    return await action();
  } catch (e) {
    if (e.code !== 409) throw e;
  }
}
await create(() => db.create({ databaseId, name: 'ScriptureSmart' }));
await create(() =>
  db.createTable({
    databaseId,
    tableId,
    name: 'Church community state',
    permissions: [],
    rowSecurity: true,
  }),
);
const table = await db.getTable({ databaseId, tableId });
if (table.$permissions.length || !table.rowSecurity)
  throw Error(
    'Existing community table has client permissions or row security disabled. Review it before using this function.',
  );
await create(() =>
  db.createStringColumn({
    databaseId,
    tableId,
    key: 'payload',
    size: 1000000,
    required: true,
    encrypt: true,
  }),
);
await create(() =>
  db.createIntegerColumn({
    databaseId,
    tableId,
    key: 'revision',
    required: true,
    min: 0,
  }),
);
await create(() =>
  db.createStringColumn({
    databaseId,
    tableId,
    key: 'viewers',
    size: 36,
    required: true,
    array: true,
  }),
);
for (let attempt = 0; attempt < 30; attempt++) {
  const t = await db.getTable({ databaseId, tableId });
  if (
    t.columns.filter((c) => ['payload', 'revision', 'viewers'].includes(c.key))
      .length === 3 &&
    t.columns
      .filter((c) => ['payload', 'revision', 'viewers'].includes(c.key))
      .every((c) => c.status === 'available')
  )
    break;
  if (attempt === 29)
    throw Error('Columns still provisioning. Re-run after they are available.');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await create(() =>
  db.createIndex({
    databaseId,
    tableId,
    key: 'viewers_lookup',
    type: TablesDBIndexType.Key,
    columns: ['viewers'],
  }),
);
console.log(
  'ScriptureSmart schema is prepared. Deploy the community Function with authenticated-user execution access and no public table/row permissions.',
);
