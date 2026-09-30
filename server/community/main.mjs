import { Account, Client, TablesDB, Query } from 'node-appwrite';
import {
  applyCommand,
  blank,
  InputError,
  newChurch,
  visible,
} from './domain.mjs';
const databaseId = process.env.COMMUNITY_DATABASE_ID || 'scripturesmart';
const tableId = process.env.COMMUNITY_TABLE_ID || 'community';
export default async ({ req, res }) => {
  let tx;
  let db;
  try {
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
    const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
    const jwt = req.headers['x-appwrite-user-jwt'];
    if (!jwt)
      return res.json({ error: 'Sign in to use your church community.' }, 401);
    const current = await new Account(
      new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt),
    ).get();
    const user = {
      id: current.$id,
      email: current.email,
      emailVerified: current.emailVerification,
    };
    if (!user.emailVerified)
      return res.json(
        { error: 'Verify your email before accessing groups.' },
        403,
      );
    const payload = req.bodyJson;
    if (!payload || JSON.stringify(payload).length > 30000)
      throw new InputError('Request is missing or too large.');
    db = new TablesDB(
      new Client()
        .setEndpoint(endpoint)
        .setProject(project)
        .setKey(req.headers['x-appwrite-key']),
    );
    const address = { databaseId, tableId };
    if (payload.action === 'church_directory') {
      const search = String(payload.search ?? '')
        .trim()
        .toLowerCase();
      if (search.length < 2) return res.json({ items: [] });
      const items = [];
      let cursor;
      for (
        let pageNumber = 0;
        pageNumber < 5 && items.length < 20;
        pageNumber++
      ) {
        const page = await db.listRows({
          ...address,
          queries: [
            Query.limit(100),
            ...(cursor ? [Query.cursorAfter(cursor)] : []),
          ],
        });
        for (const row of page.rows) {
          const c = JSON.parse(row.payload).data.churches[0];
          if ((c.name + ' ' + c.city).toLowerCase().includes(search))
            items.push({ id: c.id, name: c.name, city: c.city });
        }
        if (page.rows.length < 100) break;
        cursor = page.rows.at(-1).$id;
      }
      return res.json({ items: items.slice(0, 20) });
    }
    if (payload.action === 'snapshot') {
      const result = blank();
      let cursor;
      do {
        const page = await db.listRows({
          ...address,
          queries: [
            Query.contains('viewers', [user.id]),
            Query.limit(100),
            ...(cursor ? [Query.cursorAfter(cursor)] : []),
          ],
        });
        for (const row of page.rows) {
          const selected = visible(JSON.parse(row.payload), user);
          for (const key of Object.keys(result))
            result[key].push(...selected[key]);
        }
        cursor = page.rows.length === 100 ? page.rows.at(-1).$id : undefined;
      } while (cursor);
      return res.json({ data: result });
    }
    if (payload.action === 'create_church') {
      const state = newChurch(user, payload.identity);
      const id = state.data.churches[0].id;
      await db.createRow({
        ...address,
        rowId: id,
        data: {
          payload: JSON.stringify(state),
          revision: 0,
          viewers: [user.id],
        },
        permissions: [],
      });
      return res.json({ value: id });
    }
    const churchId =
      payload.action === 'join_group'
        ? String(payload.invite_code ?? '').split('.')[0]
        : payload.churchId;
    if (typeof churchId !== 'string' || !/^[a-zA-Z0-9-]{1,36}$/.test(churchId))
      throw new InputError('Select a church workspace.');
    tx = await db.createTransaction({ ttl: 60 });
    const record = await db.getRow({
      ...address,
      rowId: churchId,
      transactionId: tx.$id,
    });
    // Stage a revision write before reading back, then check the payload. The commit
    // rejects rows changed outside the transaction; this also detects stale reads.
    await db.updateRow({
      ...address,
      rowId: churchId,
      data: { revision: record.revision + 1 },
      transactionId: tx.$id,
    });
    const staged = await db.getRow({
      ...address,
      rowId: churchId,
      transactionId: tx.$id,
    });
    if (staged.payload !== record.payload)
      throw new InputError('Someone updated the group. Refresh and try again.');
    const { state, value } = applyCommand(
      JSON.parse(record.payload),
      user,
      payload,
    );
    const viewers = [
      ...new Set([
        state.data.churches[0].owner_id,
        ...state.data.members.map((m) => m.user_id),
        ...(state.data.church_members ?? []).map((m) => m.user_id),
      ]),
    ];
    await db.updateRow({
      ...address,
      rowId: churchId,
      data: { payload: JSON.stringify(state), viewers },
      transactionId: tx.$id,
    });
    await db.updateTransaction({ transactionId: tx.$id, commit: true });
    tx = undefined;
    return res.json({ value: value ?? null });
  } catch (e) {
    if (tx && db)
      await db
        .updateTransaction({ transactionId: tx.$id, rollback: true })
        .catch(() => {});
    if (e instanceof InputError) return res.json({ error: e.message }, 400);
    if (e.code === 409)
      return res.json(
        { error: 'Another member changed this item. Refresh and try again.' },
        409,
      );
    if (e.code === 401 || e.code === 403)
      return res.json(
        {
          error:
            'Sign in again or ask your leader to confirm your group access.',
        },
        403,
      );
    return res.json(
      {
        error:
          'The community service could not complete this request. Check deployment, database columns, and function scopes.',
      },
      500,
    );
  }
};
