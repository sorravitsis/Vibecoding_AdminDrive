**Vibecoding Guide**

Admin Drive — File Management System

*ขั้นตอนแก้ไข Schema ทั้งหมด พร้อม SQL \+ Code ครบชุด*

| 14 Flaws Found | 6 SQL Fixes | 8 Priority Steps | 1 Architecture Upgrade |
| :---: | :---: | :---: | :---: |

# **สารบัญ**

**ส่วนที่ 1**  Schema ปัจจุบัน (Before) — ปัญหาทั้งหมด

**ส่วนที่ 2**  Schema ใหม่ที่แก้ไขแล้ว (After) — ทุกตาราง

**ส่วนที่ 3**  Fix 1 — แก้ permissions table (Polymorphic → Typed)

**ส่วนที่ 4**  Fix 2 — เพิ่ม Soft Delete columns

**ส่วนที่ 5**  Fix 3 — สร้าง audit\_logs table (Activity Stream)

**ส่วนที่ 6**  Fix 4 — เพิ่ม Quota Tracking

**ส่วนที่ 7**  Fix 5 — แก้ Race Condition (Duplicate File Names)

**ส่วนที่ 8**  Fix 6 — Session Invalidation เมื่อ Suspend User

**ส่วนที่ 9**  Innovation — Google Drive Webhooks

**ส่วนที่ 10**  Priority Checklist — ลำดับการ implement

# **ส่วนที่ 1: Schema ปัจจุบัน (Before)**

| 🚨  ปัญหาที่พบในแต่ละตาราง Column ที่ขีดเส้นใต้ \= ปัญหา |
| :---- |

## **users — missing columns**

| Column | Type | Constraints | ปัญหา |
| :---- | :---- | :---- | :---- |
| user\_id | UUID | PK | — |
| email | String | UNIQUE | — |
| full\_name | String | NOT NULL | — |
| role | Enum | DEFAULT user | ขัดแย้งกับ permissions table — manager ทำอะไรได้บ้าง? ไม่ชัดเจน |
| status | Enum | DEFAULT active | — |
| created\_at | Timestamp |  | — |
| token\_version | — | MISSING | ❌ ไม่มี — suspend user แล้ว JWT ยังใช้ได้ |
| quota\_bytes | — | MISSING | ❌ ไม่มี — Storage Viz ต้อง Full Table Scan |
| used\_bytes | — | MISSING | ❌ ไม่มี — ไม่รู้ quota ใช้ไปเท่าไหร่ |
| updated\_at | — | MISSING | ❌ ไม่มี — ไม่สามารถทำ Cache Invalidation |

## **folders — missing soft delete**

| Column | Type | Constraints | ปัญหา |
| :---- | :---- | :---- | :---- |
| folder\_id | UUID | PK | — |
| google\_folder\_id | String | UNIQUE | — |
| name | String | NOT NULL | — |
| parent\_id | UUID | FK | — |
| owner\_id | UUID | FK | ไม่มี ON DELETE behavior — ถ้าลบ admin โฟลเดอร์พัง |
| is\_shared | Boolean |  | — |
| status | — | MISSING | ❌ ไม่มี — soft delete ทำไม่ได้ |
| deleted\_at | — | MISSING | ❌ ไม่มี — ไม่รู้ว่าลบเมื่อไหร่ |
| deleted\_by | — | MISSING | ❌ ไม่มี — ไม่รู้ว่าใครลบ |
| updated\_at | — | MISSING | ❌ ไม่มี |

## **files — missing soft delete \+ race condition**

| Column | Type | Constraints | ปัญหา |
| :---- | :---- | :---- | :---- |
| file\_id | UUID | PK | — |
| google\_file\_id | String | UNIQUE | — |
| folder\_id | UUID | FK | Single FK — ไม่รองรับ shortcut/alias |
| uploader\_id | UUID | FK | — |
| file\_name | String | NOT NULL | ❌ ไม่มี UNIQUE constraint — Race Condition duplicate name |
| file\_size | BigInt |  | — |
| mime\_type | String |  | — |
| created\_at | Timestamp |  | — |
| status | — | MISSING | ❌ ไม่มี soft delete |
| deleted\_at | — | MISSING | ❌ ไม่มี |
| deleted\_by | — | MISSING | ❌ ไม่มี |
| updated\_at | — | MISSING | ❌ ไม่มี |

## **permissions — broken polymorphic reference**

| ❌ ปัญหาที่ใหญ่ที่สุด item\_id ไม่มี Foreign Key และไม่มี item\_type discriminator ทำให้ไม่สามารถ JOIN กับ files หรือ folders ได้อย่างถูกต้อง และเป็น Security Risk |
| :---- |

| Column | Type | Constraints | ปัญหา |
| :---- | :---- | :---- | :---- |
| permission\_id | UUID | PK | — |
| item\_id | UUID | NOT NULL | ❌ BROKEN — ไม่รู้ว่าชี้ไปที่ file หรือ folder และไม่มี FK constraint |
| user\_id | UUID | FK | — |
| access\_level | Enum |  | — |

## **audit\_logs — ไม่มีตารางนี้เลย**

| ❌ Activity Stream พัง ณ วัน Launch Design ระบุว่าต้องมี Global Activity Stream แต่ไม่มีตารางเก็บ log เลย ถ้าไม่สร้างตารางนี้ก่อน Feature นี้ implement ไม่ได้ |
| :---- |

# **ส่วนที่ 2: Schema ใหม่ที่แก้ไขแล้ว (After)**

| ✅  Schema ฉบับสมบูรณ์ Column สีเขียว \+ ✦ \= เพิ่มใหม่ทั้งหมด |
| :---- |

## **users (Revised)**

| Column | Type | Default / Constraint | หมายเหตุ |
| :---- | :---- | :---- | :---- |
| user\_id | UUID | PK, gen\_random\_uuid() | — |
| email | String | UNIQUE, NOT NULL | Personal Gmail |
| full\_name | String | NOT NULL | — |
| role | Enum | DEFAULT 'user' | admin | manager | user |
| status | Enum | DEFAULT 'active' | active | suspended |
| created\_at | Timestamp | DEFAULT NOW() | — |
| **token\_version ✦** | Integer | DEFAULT 1 | ✦ Session invalidation |
| **quota\_bytes ✦** | BigInt | DEFAULT 5368709120 | ✦ 5GB default per user |
| **used\_bytes ✦** | BigInt | DEFAULT 0 | ✦ Update on upload/delete |
| **updated\_at ✦** | Timestamp | DEFAULT NOW() | ✦ Cache invalidation |

## **folders (Revised)**

| Column | Type | Default / Constraint | หมายเหตุ |
| :---- | :---- | :---- | :---- |
| folder\_id | UUID | PK | — |
| google\_folder\_id | String | UNIQUE, NOT NULL | — |
| name | String | NOT NULL | — |
| parent\_id | UUID | FK → folders, NULLABLE | Self-referencing hierarchy |
| owner\_id | UUID | FK → users, ON DELETE SET NULL | แก้ไข ON DELETE |
| is\_shared | Boolean | DEFAULT false | — |
| **status ✦** | Enum | DEFAULT 'active' | ✦ active | deleted |
| **deleted\_at ✦** | Timestamp | NULLABLE | ✦ Soft delete timestamp |
| **deleted\_by ✦** | UUID | FK → users, NULLABLE | ✦ ใครลบ |
| **updated\_at ✦** | Timestamp | DEFAULT NOW() | ✦ |

## **files (Revised)**

| Column | Type | Default / Constraint | หมายเหตุ |
| :---- | :---- | :---- | :---- |
| file\_id | UUID | PK | — |
| google\_file\_id | String | UNIQUE, NOT NULL | — |
| folder\_id | UUID | FK → folders | — |
| uploader\_id | UUID | FK → users | — |
| file\_name | String | NOT NULL | — |
| file\_size | BigInt |  | — |
| mime\_type | String |  | — |
| created\_at | Timestamp | DEFAULT NOW() | — |
| **status ✦** | Enum | DEFAULT 'active' | ✦ active | deleted |
| **deleted\_at ✦** | Timestamp | NULLABLE | ✦ Soft delete timestamp |
| **deleted\_by ✦** | UUID | FK → users, NULLABLE | ✦ ใครลบ |
| **updated\_at ✦** | Timestamp | DEFAULT NOW() | ✦ |
| **UNIQUE (folder\_id, file\_name) ✦** | Constraint | WHERE status='active' | ✦ Fix race condition |

## **permissions (Revised — Fixed Polymorphic)**

| Column | Type | Default / Constraint | หมายเหตุ |
| :---- | :---- | :---- | :---- |
| permission\_id | UUID | PK | — |
| **file\_id ✦** | UUID | FK → files, NULLABLE | ✦ แทน item\_id (เดิม) |
| **folder\_id ✦** | UUID | FK → folders, NULLABLE | ✦ แทน item\_id (เดิม) |
| user\_id | UUID | FK → users, NOT NULL | — |
| access\_level | Enum | NOT NULL | view | edit |
| **CHECK one\_item\_only ✦** | Constraint | (file\_id IS NOT NULL)::int \+ (folder\_id IS NOT NULL)::int \= 1 | ✦ ต้องเป็น file หรือ folder อย่างเดียว |

## **audit\_logs (New Table)**

| Column | Type | Default / Constraint | หมายเหตุ |
| :---- | :---- | :---- | :---- |
| **log\_id ✦** | UUID | PK, gen\_random\_uuid() | ✦ |
| **actor\_id ✦** | UUID | FK → users | ✦ ใครทำ action |
| **action ✦** | String | NOT NULL | ✦ upload|delete|download|restore|share |
| **target\_type ✦** | String | NOT NULL | ✦ 'file' หรือ 'folder' |
| **target\_id ✦** | UUID | NOT NULL | ✦ ID ของ item |
| **metadata ✦** | JSONB | NULLABLE | ✦ { file\_name, folder\_name, ip } |
| **created\_at ✦** | Timestamp | DEFAULT NOW() | ✦ |
| **INDEX (actor\_id, created\_at DESC) ✦** | Index |  | ✦ Activity Stream query |
| **INDEX (target\_id, created\_at DESC) ✦** | Index |  | ✦ File history query |

# **ส่วนที่ 3: Fix 1 — Permissions Table**

| 01 | แก้ Broken Polymorphic Reference ลบ item\_id ออก → แยกเป็น file\_id \+ folder\_id \+ CHECK constraint |
| :---: | :---- |

| ปัญหา item\_id ชี้ไปที่ทั้ง files และ folders แต่ไม่มี FK constraint และไม่มี item\_type discriminator ทำให้ JOIN ไม่ได้และ Security Risk |
| :---- |

### **SQL Migration**

| SQL \-- Step 1: Drop the broken column ALTER TABLE permissions DROP COLUMN item\_id; \-- Step 2: Add typed columns with proper FK ALTER TABLE permissions   ADD COLUMN file\_id   UUID REFERENCES files(file\_id)    ON DELETE CASCADE,   ADD COLUMN folder\_id UUID REFERENCES folders(folder\_id) ON DELETE CASCADE; \-- Step 3: Enforce exactly one target per row ALTER TABLE permissions   ADD CONSTRAINT one\_item\_only CHECK (     (file\_id IS NOT NULL)::int \+ (folder\_id IS NOT NULL)::int \= 1   ); \-- Step 4: Index for fast lookup CREATE INDEX idx\_perm\_file   ON permissions(file\_id, user\_id); CREATE INDEX idx\_perm\_folder ON permissions(folder\_id, user\_id); |
| :---- |

### **Application Layer — Query สิทธิ์ที่ถูกต้อง**

| SQL \-- ดึง files ที่ user มีสิทธิ์เข้าถึง (ชัดเจน ไม่ต้องเดา item\_type อีกต่อไป) SELECT f.\* FROM files f JOIN permissions p ON p.file\_id \= f.file\_id WHERE p.user\_id \= $1   AND p.access\_level IN ('view', 'edit')   AND f.status \= 'active'; \-- ดึง folders ที่ user มีสิทธิ์ SELECT fo.\* FROM folders fo JOIN permissions p ON p.folder\_id \= fo.folder\_id WHERE p.user\_id \= $1   AND fo.status \= 'active'; |
| :---- |

# **ส่วนที่ 4: Fix 2 — Soft Delete**

| 02 | เพิ่ม Soft Delete Columns เพิ่ม status \+ deleted\_at \+ deleted\_by ใน files และ folders |
| :---: | :---- |

| ปัญหา QA กำหนดว่าต้องมี Recycle Bin และ Admin กู้คืนได้ แต่ไม่มี column เก็บ state นี้เลย |
| :---- |

### **SQL Migration**

| SQL \-- files table ALTER TABLE files   ADD COLUMN status     VARCHAR(20) NOT NULL DEFAULT 'active'                         CHECK (status IN ('active', 'deleted')),   ADD COLUMN deleted\_at TIMESTAMP,   ADD COLUMN deleted\_by UUID REFERENCES users(user\_id),   ADD COLUMN updated\_at TIMESTAMP DEFAULT NOW(); \-- folders table ALTER TABLE folders   ADD COLUMN status     VARCHAR(20) NOT NULL DEFAULT 'active'                         CHECK (status IN ('active', 'deleted')),   ADD COLUMN deleted\_at TIMESTAMP,   ADD COLUMN deleted\_by UUID REFERENCES users(user\_id),   ADD COLUMN updated\_at TIMESTAMP DEFAULT NOW(); \-- Safety view: ป้องกัน query เจอ deleted records โดยไม่ตั้งใจ CREATE VIEW active\_files AS   SELECT \* FROM files WHERE status \= 'active'; CREATE VIEW active\_folders AS   SELECT \* FROM folders WHERE status \= 'active'; |
| :---- |

### **Before vs After — API Delete Endpoint**

| ❌ Before (Hard Delete) // DELETE /files/:id await db.query(   'DELETE FROM files    WHERE file\_id \= $1',   \[req.params.id\] ); // ข้อมูลหายถาวร ไม่กู้คืนได้ | ✅ After (Soft Delete) // DELETE /files/:id await db.query(\`   UPDATE files SET     status     \= 'deleted',     deleted\_at \= NOW(),     deleted\_by \= $2   WHERE file\_id \= $1 \`, \[req.params.id, req.user.id\]); // Admin ยังกู้คืนได้ |
| :---- | :---- |

### **Admin Restore Endpoint**

| JAVASCRIPT // POST /admin/files/:id/restore await db.query(\`   UPDATE files SET     status     \= 'active',     deleted\_at \= NULL,     deleted\_by \= NULL,     updated\_at \= NOW()   WHERE file\_id \= $1 \`, \[req.params.id\]); |
| :---- |

### **Recycle Bin Query**

| SQL \-- Recycle bin: ดู deleted files ทั้งหมด SELECT   f.file\_name,   f.deleted\_at,   u.full\_name AS deleted\_by\_name FROM files f JOIN users u ON u.user\_id \= f.deleted\_by WHERE f.status \= 'deleted' ORDER BY f.deleted\_at DESC; |
| :---- |

# **ส่วนที่ 5: Fix 3 — audit\_logs Table**

| 03 | สร้าง audit\_logs (Activity Stream) ไม่มีตารางนี้ \= Activity Stream Feature พัง ณ วัน Launch |
| :---: | :---- |

| ปัญหา Design กำหนดว่าต้องมี Global Activity Stream แสดงว่า 'พนักงาน A อัปโหลดไฟล์ X' แต่ไม่มีตารางเก็บ event log เลย |
| :---- |

### **SQL — สร้างตาราง**

| SQL CREATE TABLE audit\_logs (   log\_id      UUID        PRIMARY KEY DEFAULT gen\_random\_uuid(),   actor\_id    UUID        REFERENCES users(user\_id) ON DELETE SET NULL,   action      VARCHAR(50) NOT NULL,     \-- Values: 'upload' | 'delete' | 'restore' | 'download' | 'share' | 'rename'   target\_type VARCHAR(20) NOT NULL,     \-- Values: 'file' | 'folder'   target\_id   UUID        NOT NULL,   metadata    JSONB,     \-- Example: { file\_name: 'report.pdf', folder\_id: '...', ip: '...' }   created\_at  TIMESTAMP   NOT NULL DEFAULT NOW() ); \-- Indexes for fast Activity Stream queries CREATE INDEX idx\_audit\_actor\_time  ON audit\_logs(actor\_id, created\_at DESC); CREATE INDEX idx\_audit\_target\_time ON audit\_logs(target\_id, created\_at DESC); CREATE INDEX idx\_audit\_recent      ON audit\_logs(created\_at DESC); |
| :---- |

### **Application Layer — เรียกหลังทุก Action**

| JAVASCRIPT // Helper function — เรียกใช้ได้ทุก endpoint async function logAction(actorId, action, targetType, targetId, metadata \= {}) {   await db.query(\`     INSERT INTO audit\_logs (actor\_id, action, target\_type, target\_id, metadata)     VALUES ($1, $2, $3, $4, $5)   \`, \[actorId, action, targetType, targetId, JSON.stringify(metadata)\]); } // ตัวอย่าง: หลัง upload const newFile \= await db.files.insert({ ...fileData }); await logAction(req.user.id, 'upload', 'file', newFile.file\_id, {   file\_name: newFile.file\_name,   folder\_id: newFile.folder\_id,   file\_size: newFile.file\_size }); // ตัวอย่าง: หลัง soft delete await db.files.update({ status: 'deleted', ...}); await logAction(req.user.id, 'delete', 'file', req.params.id, {   file\_name: file.file\_name }); |
| :---- |

### **Activity Stream Query — Frontend**

| SQL \-- Global Activity Feed (50 รายการล่าสุด) SELECT   u.full\_name                    AS actor\_name,   a.action,   a.target\_type,   a.metadata-\>\>'file\_name'       AS file\_name,   a.metadata-\>\>'folder\_name'     AS folder\_name,   a.created\_at FROM audit\_logs a LEFT JOIN users u ON u.user\_id \= a.actor\_id ORDER BY a.created\_at DESC LIMIT 50; \-- Activity ของ User คนเดียว SELECT \* FROM audit\_logs WHERE actor\_id \= $1 ORDER BY created\_at DESC LIMIT 20; |
| :---- |

# **ส่วนที่ 6: Fix 4 — Quota Tracking**

| 04 | เพิ่ม Quota Tracking บน users ป้องกัน Full Table Scan ทุก Page Load บน Storage Visualization |
| :---: | :---- |

### **SQL Migration**

| SQL ALTER TABLE users   ADD COLUMN quota\_bytes BIGINT NOT NULL DEFAULT 5368709120,  \-- 5 GB   ADD COLUMN used\_bytes  BIGINT NOT NULL DEFAULT 0; \-- Backfill existing data UPDATE users u SET used\_bytes \= (   SELECT COALESCE(SUM(f.file\_size), 0\)   FROM files f   WHERE f.uploader\_id \= u.user\_id     AND f.status \= 'active' ); |
| :---- |

### **Application Layer — Update used\_bytes**

| JAVASCRIPT // หลัง upload สำเร็จ await db.query(\`   UPDATE users   SET used\_bytes \= used\_bytes \+ $1,       updated\_at \= NOW()   WHERE user\_id \= $2 \`, \[file.file\_size, req.user.id\]); // หลัง soft delete await db.query(\`   UPDATE users   SET used\_bytes \= GREATEST(0, used\_bytes \- $1),       updated\_at \= NOW()   WHERE user\_id \= $2 \`, \[file.file\_size, file.uploader\_id\]); // Check quota ก่อน upload const user \= await db.query(   'SELECT quota\_bytes, used\_bytes FROM users WHERE user\_id \= $1',   \[req.user.id\] ); if (user.used\_bytes \+ file.size \> user.quota\_bytes) {   throw new Error('Quota exceeded'); } |
| :---- |

### **Storage Visualization Query — O(1) แทน O(n)**

| ❌ Before — Full Table Scan \-- ทุก page load ทำแบบนี้ SELECT   uploader\_id,   SUM(file\_size) AS used FROM files WHERE status \= 'active' GROUP BY uploader\_id; \-- O(n) — scan ทุก row\! | ✅ After — O(1) Column Read \-- Read จาก column โดยตรง SELECT   full\_name,   used\_bytes,   quota\_bytes,   ROUND(used\_bytes \* 100.0     / quota\_bytes, 1\) AS pct FROM users; \-- O(1) — fast เสมอ |
| :---- | :---- |

# **ส่วนที่ 7: Fix 5 — Race Condition**

| 05 | แก้ Duplicate File Name Race Condition DB-level UNIQUE constraint \+ Advisory Lock ใน Transaction |
| :---: | :---- |

| ปัญหา ถ้า 2 users อัปโหลดไฟล์ชื่อเดิมพร้อมกัน application layer append (1) ทั้งคู่พร้อมกัน ก่อนที่จะ insert — ได้ชื่อซ้ำกันทั้งคู่ |
| :---- |

### **SQL — DB-level Constraint**

| SQL \-- Unique constraint เฉพาะ active files เท่านั้น \-- (deleted files ซ้ำชื่อได้ — อยู่ใน recycle bin) ALTER TABLE files   ADD CONSTRAINT unique\_active\_file\_per\_folder   UNIQUE (folder\_id, file\_name)   WHERE (status \= 'active'); |
| :---- |

### **Application Layer — Serializable Transaction**

| JAVASCRIPT async function uploadFile(folderId, fileName, fileData, userId) {   const client \= await db.connect();   try {     await client.query('BEGIN');     // Lock the folder row — ป้องกัน concurrent upload เดียวกัน     await client.query(       'SELECT id FROM folders WHERE folder\_id \= $1 FOR UPDATE',       \[folderId\]     );     // หาชื่อที่ไม่ซ้ำ (ปลอดภัย เพราะ lock แล้ว)     const safeName \= await getUniqueName(client, folderId, fileName);     // Insert     const file \= await client.query(       'INSERT INTO files (folder\_id, file\_name, ...) VALUES ($1, $2, ...)',       \[folderId, safeName, ...\]     );     await client.query('COMMIT');     return file;   } catch (err) {     await client.query('ROLLBACK');     throw err;   } finally {     client.release();   } } async function getUniqueName(client, folderId, fileName) {   const ext  \= path.extname(fileName);   const base \= path.basename(fileName, ext);   let name \= fileName, i \= 1;   while (true) {     const { rows } \= await client.query(       'SELECT 1 FROM files WHERE folder\_id=$1 AND file\_name=$2 AND status=$3',       \[folderId, name, 'active'\]     );     if (rows.length \=== 0\) return name;     name \= \`${base}(${i++})${ext}\`;   } } |
| :---- |

# **ส่วนที่ 8: Fix 6 — Session Invalidation**

| 06 | Session Invalidation เมื่อ Suspend User พนักงานที่ลาออกต้องหมดสิทธิ์ทันที ไม่รอ JWT หมดอายุ |
| :---: | :---- |

| ปัญหา ถ้า Admin suspend user ระหว่างที่ยังมี active session พนักงานคนนั้นยังใช้งานได้จนกว่า JWT จะหมดอายุ — อาจนานหลายชั่วโมง |
| :---- |

### **SQL Migration**

| SQL ALTER TABLE users   ADD COLUMN token\_version INTEGER NOT NULL DEFAULT 1; |
| :---- |

### **Suspend \+ Invalidate**

| SQL \-- เมื่อ Admin กด Suspend — increment token\_version ทันที UPDATE users SET   status        \= 'suspended',   token\_version \= token\_version \+ 1,   updated\_at    \= NOW() WHERE user\_id \= $1; \-- เมื่อ Reactivate UPDATE users SET   status     \= 'active',   updated\_at \= NOW() WHERE user\_id \= $1; \-- token\_version ไม่ต้อง reset — token เก่าใช้ไม่ได้อยู่แล้ว |
| :---- |

### **JWT — Embed token\_version ตอน Login**

| JAVASCRIPT // Login: embed token\_version ใน JWT payload const token \= jwt.sign({   userId:       user.user\_id,   email:        user.email,   tokenVersion: user.token\_version,  // \<-- embed ตรงนี้ }, process.env.JWT\_SECRET, { expiresIn: '8h' }); |
| :---- |

### **Middleware — ตรวจสอบทุก Request**

| JAVASCRIPT // Auth middleware — ทำงานทุก protected route async function authMiddleware(req, res, next) {   try {     const payload \= jwt.verify(req.headers.authorization, process.env.JWT\_SECRET);     // ดึง current token\_version จาก DB     const { rows } \= await db.query(       'SELECT token\_version, status FROM users WHERE user\_id \= $1',       \[payload.userId\]     );     const user \= rows\[0\];     // ตรวจสอบ 2 เงื่อนไข     if (\!user || user.status \=== 'suspended') {       return res.status(401).json({ error: 'Account suspended' });     }     if (user.token\_version \!== payload.tokenVersion) {       return res.status(401).json({ error: 'Session expired' });     }     req.user \= payload;     next();   } catch (err) {     res.status(401).json({ error: 'Invalid token' });   } } |
| :---- |

# **ส่วนที่ 9: Innovation — Google Drive Webhooks**

| 07 | แทน Nightly Sync ด้วย Push Notifications ข้อมูล real-time ภายใน 1-2 วินาที แทนที่จะรอ 24 ชั่วโมง |
| :---: | :---- |

| 💡  ทำไมต้อง Webhooks? Nightly Sync \= ข้อมูลเก่าสูงสุด 24h \+ Silent Fail \+ Activity Stream ไม่ Real-time |
| :---- |

### **Architecture Flow**

| SQL Google Drive (file changed/deleted)   → POST /webhooks/drive  (your server, within \~2 seconds)     → Verify X-Goog-Channel-Token       → Parse X-Goog-Resource-State: exists | not\_exists | update         → UPDATE database           → INSERT audit\_logs             → Broadcast via WebSocket → Activity Stream (real-time\!) |
| :---- |

### **Step 1 — Register Webhook Channel**

| JAVASCRIPT // Register once per file/folder you want to watch // (or watch the entire shared drive) const response \= await googleDrive.files.watch({   fileId: 'YOUR\_FOLDER\_ID',  // or 'root' for entire drive   requestBody: {     kind:    'api\#channel',     id:      crypto.randomUUID(),  // unique per registration     type:    'web\_hook',     address: 'https://yourapp.com/webhooks/drive',     token:   process.env.WEBHOOK\_SECRET,  // verify requests     expiration: Date.now() \+ (7 \* 24 \* 60 \* 60 \* 1000),  // 7 days   } }); // ต้อง renew ก่อน expiration หรือ set up auto-renewal |
| :---- |

### **Step 2 — Webhook Endpoint**

| JAVASCRIPT app.post('/webhooks/drive', async (req, res) \=\> {   // 1\. Verify the request is from Google   const token \= req.headers\['x-goog-channel-token'\];   if (token \!== process.env.WEBHOOK\_SECRET) {     return res.status(403).send('Forbidden');   }   // 2\. Respond immediately (Google expects \< 10s)   res.status(200).send();   // 3\. Process async   const state      \= req.headers\['x-goog-resource-state'\];   const resourceId \= req.headers\['x-goog-resource-id'\];   if (state \=== 'not\_exists') {     // File deleted directly on Drive     await db.query(\`       UPDATE files SET status='deleted', deleted\_at=NOW()       WHERE google\_file\_id \= $1     \`, \[resourceId\]);     await logAction(null, 'delete\_external', 'file', resourceId, {       source: 'google\_drive\_webhook'     });   } else if (state \=== 'update') {     // File metadata changed — sync name, size     const meta \= await googleDrive.files.get({       fileId: resourceId,       fields: 'name,size,modifiedTime'     });     await db.query(\`       UPDATE files       SET file\_name=$1, file\_size=$2, updated\_at=$3       WHERE google\_file\_id \= $4     \`, \[meta.name, meta.size, meta.modifiedTime, resourceId\]);   }   // 4\. Broadcast to WebSocket → Activity Stream real-time   wss.clients.forEach(client \=\> {     if (client.readyState \=== WebSocket.OPEN) {       client.send(JSON.stringify({ event: 'drive\_change', state, resourceId }));     }   }); }); |
| :---- |

### **เปรียบเทียบ Nightly Sync vs Webhooks**

| Aspect | Nightly Sync (Current) | Webhooks (Recommended) |
| :---- | :---- | :---- |
| **Data Freshness** | Up to 24h stale | \~1-2 วินาที |
| **Failure Handling** | Silent fail ไม่มี alert | HTTP retry \+ dead-letter queue |
| **Activity Stream** | Log polling (delayed) | Real-time WebSocket broadcast |
| **Infrastructure** | Cron job (fragile, stateful) | Stateless HTTP endpoint (robust) |
| **Scalability** | Full scan ทุกคืน | Event-driven, scales to zero |

# **ส่วนที่ 10: Priority Checklist**

| 🎯  ลำดับการ Implement สำหรับ Vibecoding ทำตามลำดับนี้ — แต่ละข้อ unblock ข้อถัดไป |
| :---- |

| \# | Priority | Task | Detail / SQL File |
| ----- | :---- | :---- | :---- |
| **1** | **CRITICAL** | **Fix permissions table** | DROP item\_id → ADD file\_id \+ folder\_id \+ CHECK (ส่วนที่ 3\) |
| **2** | **CRITICAL** | **Create audit\_logs table** | Activity Stream ต้องการตารางนี้ก่อน (ส่วนที่ 5\) |
| **3** | **HIGH** | **Add soft delete columns** | ALTER files \+ folders: status, deleted\_at, deleted\_by (ส่วนที่ 4\) |
| **4** | **HIGH** | **Add token\_version to users** | Suspend user ให้ kick session ทันที (ส่วนที่ 8\) |
| **5** | **HIGH** | **Add UNIQUE constraint on files** | UNIQUE (folder\_id, file\_name) WHERE active (ส่วนที่ 7\) |
| **6** | **MEDIUM** | **Add quota columns to users** | quota\_bytes \+ used\_bytes (ส่วนที่ 6\) |
| **7** | **MEDIUM** | **Implement Drive Webhooks** | แทน nightly sync → real-time (ส่วนที่ 9\) |
| **8** | **LOW** | **Define manager role clearly** | ระบุชัดว่า manager ทำอะไรได้มากกว่า user บ้าง |

| Quick Start สำหรับ Vibecoding 1\. Run migrations ตามลำดับ: Fix 1 → Fix 2 → Fix 3 (permissions → soft delete → audit\_logs) 2\. เพิ่ม logAction() call ทุก endpoint ที่ modify data (upload, delete, restore, share) 3\. เปลี่ยน auth middleware ให้ตรวจ token\_version ทุก request 4\. เปลี่ยนทุก SELECT ให้ include WHERE status \= 'active' หรือใช้ View active\_files 5\. Register Drive webhook หลังจาก deploy เสร็จ (ทำทีหลังก็ได้) |
| :---- |

