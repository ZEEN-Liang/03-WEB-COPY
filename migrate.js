// 一次性迁移脚本：给现有数据库添加缺失的列
// 运行方式：node migrate.js
// 运行完成后可以删除此文件

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'forum.db.bin');

async function migrate() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('❌ 找不到数据库文件 forum.db.bin，请确认在 forum 目录下运行');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db  = new SQL.Database(fs.readFileSync(DB_FILE));

  // 检查并添加缺失的列
  const cols = [
    { sql: "ALTER TABLE users ADD COLUMN nickname    TEXT DEFAULT NULL", name: "users.nickname" },
    { sql: "ALTER TABLE users ADD COLUMN bio         TEXT DEFAULT NULL", name: "users.bio" },
    { sql: "ALTER TABLE users ADD COLUMN instruments TEXT DEFAULT NULL", name: "users.instruments" },
    { sql: "ALTER TABLE users ADD COLUMN avatar       TEXT    DEFAULT NULL",    name: "users.avatar" },
    { sql: "ALTER TABLE users ADD COLUMN show_follows INTEGER DEFAULT 1",          name: "users.show_follows" },
    { sql: "ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL", name: "comments.parent_id" },
    { sql: "ALTER TABLE comments ADD COLUMN reply_to TEXT DEFAULT NULL",    name: "comments.reply_to" },
    { sql: "ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'", name: "posts.status" },
  ];

  let changed = 0;
  for (const { sql, name } of cols) {
    try {
      db.run(sql);
      console.log(`✅ 新增列: ${name}`);
      changed++;
    } catch(e) {
      console.log(`— 已存在: ${name}`);
    }
  }

  // 验证最终结构
  console.log('\n📋 当前 users 表结构:');
  const info = db.exec("PRAGMA table_info(users)");
  if (info[0]) {
    info[0].values.forEach(row => console.log(`   ${row[1]} (${row[2]})`));
  }

  // 保存
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  console.log(`\n✅ 迁移完成，共新增 ${changed} 列，数据库已保存`);
  console.log('   现在可以运行 node server.js 启动服务器\n');
}

migrate().catch(console.error);
