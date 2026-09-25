// Supabase JS istemcisinin backend'de kullanılan alt kümesini PGlite (WASM Postgres)
// üzerinde uygular. Testler böylece gerçek şema, constraint ve RPC fonksiyonlarıyla
// (ör. matchmake_player) çalışır; ağ veya Supabase projesi gerekmez.
//
// Desteklenen: from().select/insert/upsert/update/delete, eq/neq/gt/gte/lt/lte/is/in,
// order, limit, single, maybeSingle, count/head ve "alias:fk(cols)" gömülü ilişkiler; rpc().

const quoteIdent = name => `"${String(name).replace(/"/g, '""')}"`;

function splitTopLevel(input) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSelect(columns) {
  return splitTopLevel(columns || '*').map(part => {
    const relation = part.match(/^(\w+)(?::(\w+))?\s*\(([\s\S]*)\)$/);
    if (relation) {
      return { type: 'relation', alias: relation[1], name: relation[2] || relation[1], children: parseSelect(relation[3]) };
    }
    if (part === '*') return { type: 'star' };
    return { type: 'column', name: part };
  });
}

function toParam(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.action = 'select';
    this.columns = '*';
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
    this.returning = false;
    this.mode = null;
    this.countMode = null;
    this.head = false;
  }

  select(columns = '*', options = {}) {
    if (this.action === 'select') {
      this.columns = columns;
      this.countMode = options.count || null;
      this.head = !!options.head;
    } else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }

  insert(values) { this.action = 'insert'; this.values = [].concat(values); return this; }
  upsert(values, options = {}) { this.action = 'upsert'; this.values = [].concat(values); this.onConflict = options.onConflict; return this; }
  update(values) { this.action = 'update'; this.values = values; return this; }
  delete() { this.action = 'delete'; return this; }

  eq(column, value) { this.filters.push({ op: '=', column, value }); return this; }
  neq(column, value) { this.filters.push({ op: '<>', column, value }); return this; }
  gt(column, value) { this.filters.push({ op: '>', column, value }); return this; }
  gte(column, value) { this.filters.push({ op: '>=', column, value }); return this; }
  lt(column, value) { this.filters.push({ op: '<', column, value }); return this; }
  lte(column, value) { this.filters.push({ op: '<=', column, value }); return this; }
  is(column, value) { this.filters.push({ op: 'is', column, value }); return this; }
  in(column, values) { this.filters.push({ op: 'in', column, value: values }); return this; }

  order(column, { ascending = true } = {}) { this.orders.push({ column, ascending }); return this; }
  limit(count) { this.limitCount = count; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  whereClause(params) {
    if (!this.filters.length) return '';
    const clauses = this.filters.map(({ op, column, value }) => {
      const col = `t0.${quoteIdent(column)}`;
      if (op === 'is') {
        if (value === null) return `${col} IS NULL`;
        return `${col} IS ${value ? 'TRUE' : 'FALSE'}`;
      }
      if (op === 'in') {
        if (!value.length) return 'FALSE';
        const placeholders = value.map(item => { params.push(toParam(item)); return `$${params.length}`; });
        return `${col} IN (${placeholders.join(', ')})`;
      }
      params.push(toParam(value));
      return `${col} ${op} $${params.length}`;
    });
    return ` WHERE ${clauses.join(' AND ')}`;
  }

  async execute() {
    try {
      const meta = await this.client.metadata();
      const { sql, params } = this.build(meta);
      const result = await this.client.db.query(sql, params);

      if (this.action === 'select' && this.countMode) {
        const count = Number(result.rows[0]?.count ?? 0);
        return { data: this.head ? null : result.rows.map(row => row.row), count, error: null, status: 200 };
      }

      const returnsRows = this.action === 'select' || this.returning;
      if (!returnsRows) return { data: null, error: null, status: 204 };

      const rows = result.rows.map(row => row.row);
      if (this.mode === 'single' || this.mode === 'maybe') {
        if (rows.length === 1) return { data: rows[0], error: null, status: 200 };
        if (rows.length === 0 && this.mode === 'maybe') return { data: null, error: null, status: 200 };
        return {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `Results contain ${rows.length} rows` },
          status: 406
        };
      }
      return { data: rows, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: { message: error.message, code: error.code, details: error.detail }, status: 400 };
    }
  }

  build(meta) {
    const params = [];
    const table = quoteIdent(this.table);
    const projection = () => `${this.client.objectExpression(meta, this.table, 't0', parseSelect(this.columns))} AS row`;

    if (this.action === 'select') {
      if (this.countMode && this.head) {
        return { sql: `SELECT count(*) AS count FROM ${table} t0${this.whereClause(params)}`, params };
      }
      let sql = `SELECT ${projection()}${this.countMode ? ', count(*) OVER () AS count' : ''} FROM ${table} t0${this.whereClause(params)}`;
      if (this.orders.length) {
        sql += ` ORDER BY ${this.orders.map(o => `t0.${quoteIdent(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
      }
      if (this.limitCount !== null) sql += ` LIMIT ${Number(this.limitCount)}`;
      return { sql, params };
    }

    let mutation;
    if (this.action === 'insert' || this.action === 'upsert') {
      const columns = [...new Set(this.values.flatMap(row => Object.keys(row)))];
      const rows = this.values.map(row => `(${columns.map(column => {
        if (row[column] === undefined) return 'DEFAULT';
        params.push(toParam(row[column]));
        return `$${params.length}`;
      }).join(', ')})`);
      mutation = `INSERT INTO ${table} AS t0 (${columns.map(quoteIdent).join(', ')}) VALUES ${rows.join(', ')}`;
      if (this.action === 'upsert') {
        const conflict = this.onConflict ? this.onConflict.split(',').map(c => c.trim()) : meta.primaryKeys[this.table];
        const updates = columns.filter(column => !conflict.includes(column));
        mutation += ` ON CONFLICT (${conflict.map(quoteIdent).join(', ')}) DO ${updates.length
          ? `UPDATE SET ${updates.map(column => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(', ')}`
          : 'NOTHING'}`;
      }
    } else if (this.action === 'update') {
      const assignments = Object.entries(this.values)
        .filter(([, value]) => value !== undefined)
        .map(([column, value]) => { params.push(toParam(value)); return `${quoteIdent(column)} = $${params.length}`; });
      mutation = `UPDATE ${table} AS t0 SET ${assignments.join(', ')}${this.whereClause(params)}`;
    } else {
      mutation = `DELETE FROM ${table} AS t0${this.whereClause(params)}`;
    }

    return { sql: `WITH t0 AS (${mutation} RETURNING t0.*) SELECT ${projection()} FROM t0`, params };
  }
}

export class PgliteSupabase {
  constructor(db) {
    this.db = db;
    this._meta = null;
  }

  async metadata() {
    if (this._meta) return this._meta;
    const fks = await this.db.query(`
      SELECT cl.relname AS table_name, att.attname AS column_name, ref.relname AS ref_table, refatt.attname AS ref_column
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
      JOIN pg_class ref ON ref.oid = c.confrelid
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
      JOIN pg_attribute refatt ON refatt.attrelid = c.confrelid AND refatt.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`);
    const pks = await this.db.query(`
      SELECT cl.relname AS table_name, att.attname AS column_name
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY(c.conkey)
      WHERE c.contype = 'p'`);
    const primaryKeys = {};
    pks.rows.forEach(row => { (primaryKeys[row.table_name] ||= []).push(row.column_name); });
    this._meta = { foreignKeys: fks.rows, primaryKeys };
    return this._meta;
  }

  resolveRelation(meta, table, name) {
    const direct = meta.foreignKeys.find(fk => fk.table_name === table && fk.column_name === name)
      || meta.foreignKeys.find(fk => fk.table_name === table && fk.ref_table === name);
    if (direct) return { kind: 'one', table: direct.ref_table, localColumn: direct.column_name, remoteColumn: direct.ref_column };
    const reverse = meta.foreignKeys.find(fk => fk.table_name === name && fk.ref_table === table);
    if (reverse) return { kind: 'many', table: name, localColumn: reverse.ref_column, remoteColumn: reverse.column_name };
    throw new Error(`Could not find a relationship between '${table}' and '${name}'`);
  }

  objectExpression(meta, table, alias, items, depth = 0) {
    const pairs = [];
    let base = null;
    items.forEach((item, index) => {
      if (item.type === 'star') {
        base = `to_jsonb(${alias})`;
      } else if (item.type === 'column') {
        pairs.push(`'${item.name}', ${alias}.${quoteIdent(item.name)}`);
      } else {
        const relation = this.resolveRelation(meta, table, item.name);
        const childAlias = `r${depth}_${index}`;
        const childObject = this.objectExpression(meta, relation.table, childAlias, item.children, depth + 1);
        const join = `FROM ${quoteIdent(relation.table)} ${childAlias} WHERE ${childAlias}.${quoteIdent(relation.remoteColumn)} = ${alias}.${quoteIdent(relation.localColumn)}`;
        const expression = relation.kind === 'one'
          ? `(SELECT ${childObject} ${join} LIMIT 1)`
          : `COALESCE((SELECT jsonb_agg(${childObject}) ${join}), '[]'::jsonb)`;
        pairs.push(`'${item.alias}', ${expression}`);
      }
    });
    const built = pairs.length ? `jsonb_build_object(${pairs.join(', ')})` : null;
    if (base && built) return `${base} || ${built}`;
    return base || built || "'{}'::jsonb";
  }

  from(table) {
    return new QueryBuilder(this, table);
  }

  async rpc(fn, args = {}) {
    try {
      const info = await this.db.query(
        `SELECT p.proretset, t.typname FROM pg_proc p JOIN pg_type t ON t.oid = p.prorettype
         JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1 LIMIT 1`,
        [fn]
      );
      if (!info.rows.length) {
        return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${fn}` } };
      }
      const entries = Object.entries(args);
      const params = entries.map(([, value]) => toParam(value));
      const argSql = entries.map(([name], index) => `${quoteIdent(name)} => $${index + 1}`).join(', ');
      const { proretset, typname } = info.rows[0];

      if (proretset) {
        const result = await this.db.query(`SELECT to_jsonb(r) AS row FROM ${quoteIdent(fn)}(${argSql}) r`, params);
        return { data: result.rows.map(row => row.row), error: null };
      }
      if (typname === 'void') {
        await this.db.query(`SELECT ${quoteIdent(fn)}(${argSql})`, params);
        return { data: null, error: null };
      }
      const result = await this.db.query(`SELECT to_jsonb(${quoteIdent(fn)}(${argSql})) AS value`, params);
      return { data: result.rows[0]?.value ?? null, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message, code: error.code, details: error.detail } };
    }
  }
}
