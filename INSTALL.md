# คู่มือติดตั้งและตั้งค่าระบบ

สำหรับผู้ดูแลเซิร์ฟเวอร์ที่จะนำโปรแกรมทดลองคำนวณเกรดเฉลี่ยสะสม (GPA) จาก GitHub ไปใช้งาน

## 1. สิ่งที่ต้องมี

| รายการ | ต้องการ |
|---|---|
| เว็บเซิร์ฟเวอร์ | Apache หรือ Nginx |
| PHP | 8.1 ขึ้นไป |
| ส่วนเสริม PHP | `pdo_sqlite`, `mbstring`, `session`, `json` |
| ฐานข้อมูล | SQLite (มากับ PHP ไม่ต้องติดตั้งเซิร์ฟเวอร์ฐานข้อมูล) |
| ใบรับรอง | HTTPS (มีหน้าเข้าสู่ระบบ) |

เบราว์เซอร์ของผู้ใช้จะเรียก Google Fonts และ `abacus.jasoncameron.dev` (นับจำนวนผู้ใช้) ถ้าเครือข่ายบล็อก หน้าคำนวณยังใช้ได้ แต่ฟอนต์จะเปลี่ยนและยอดผู้ใช้ไม่ขึ้น

## 2. ติดตั้งบน Ubuntu + Apache

ตัวอย่างใช้ `/var/www/html/gpa-lab` เปลี่ยนได้ตามจริง

```bash
sudo apt update
sudo apt install -y apache2 git php libapache2-mod-php php-sqlite3 php-mbstring
sudo timedatectl set-timezone Asia/Bangkok
sudo git clone https://github.com/<ชื่อบัญชี>/<ชื่อ repo>.git /var/www/html/gpa-lab
```

ตั้งสิทธิ์ให้เว็บเขียนได้เฉพาะโฟลเดอร์ `data`

```bash
sudo chown -R www-data:www-data /var/www/html/gpa-lab/data
sudo chmod 750 /var/www/html/gpa-lab/data
```

สร้าง `/etc/apache2/conf-available/gpa-lab.conf`

```apache
<Directory /var/www/html/gpa-lab>
    AllowOverride All
    Require all granted
</Directory>
<DirectoryMatch "^/var/www/html/gpa-lab/(data|database|\.git)">
    Require all denied
</DirectoryMatch>
```

```bash
sudo a2enconf gpa-lab
sudo a2enmod headers
sudo systemctl restart apache2
```

### ถ้าใช้ Nginx

Nginx ไม่อ่าน `.htaccess` ต้องเพิ่มใน `server { }` เอง และวางไว้ก่อน location ของ PHP

```nginx
location ~ ^/gpa-lab/(data|database|\.git)(/|$) { deny all; }
```

## 3. ตั้งค่าครั้งแรก (Setup)

```bash
cd /var/www/html/gpa-lab
sudo -u www-data php setup.php
```

ระบบจะตรวจเครื่อง สร้าง `data/gpa_lab.db` แล้วให้ตั้งชื่อผู้ใช้และรหัสผ่านซุปเปอร์แอดมิน (อย่างน้อย 8 ตัว) ไม่มีบัญชีหรือรหัสเริ่มต้นมาให้

จากนั้นเปิด `https://<โดเมน>/gpa-lab/#admin` เข้าสู่ระบบ แล้วเพิ่มแอดมินทั่วไปที่แท็บ "จัดการแอดมิน"

## 4. ตรวจหลังติดตั้ง

```bash
curl -s https://<โดเมน>/gpa-lab/api/feedback.php
curl -s -o /dev/null -w "%{http_code}\n" https://<โดเมน>/gpa-lab/data/gpa_lab.db
curl -s -o /dev/null -w "%{http_code}\n" https://<โดเมน>/gpa-lab/.git/config
```

- คำสั่งแรกต้องได้ข้อความขึ้นต้นด้วย `{"total":0` (อ่านฐานข้อมูลได้)
- สองคำสั่งหลังต้องได้ `403` หรือ `404` **ถ้าได้ `200` ห้ามเปิดใช้งาน** ให้แก้ข้อ 2 ก่อน
- หน้าแอดมินต้องมีแถบเขียว "เชื่อมต่อฐานข้อมูลแล้ว" ถ้าไม่มี แปลว่าต่อฐานข้อมูลไม่ได้ ข้อมูลที่เห็นเป็นข้อมูลตัวอย่างในเครื่องนั้น
- ลองส่งแบบประเมิน 1 ครั้ง แล้วดูว่าขึ้นในหน้าแอดมิน

## 5. ติดตั้งในเครื่องตัวเองด้วย XAMPP

1. ติดตั้ง XAMPP รุ่นที่มี PHP 8.1 ขึ้นไป
2. วางโฟลเดอร์ `gpa-lab` ไว้ใน `htdocs` (Mac `/Applications/XAMPP/htdocs`, Windows `C:\xampp\htdocs`)
3. เปิด Terminal / Command Prompt ในโฟลเดอร์ `gpa-lab` แล้วรัน
   - Mac: `/Applications/XAMPP/xamppfiles/bin/php setup.php` แล้ว `chmod 777 data && chmod 666 data/gpa_lab.db` (เฉพาะเครื่องทดสอบ)
   - Windows: `C:\xampp\php\php.exe setup.php`
4. กด Start ที่ Apache แล้วเปิด http://localhost/gpa-lab/

## 6. ดูแลระบบ

| งาน | วิธี |
|---|---|
| สำรองข้อมูล | `sudo sqlite3 data/gpa_lab.db ".backup '/ที่เก็บ/gpa_lab.db'"` (ต้องติดตั้ง `sqlite3`) |
| กู้คืน | หยุด Apache วางไฟล์สำรองทับ `data/gpa_lab.db` แล้ว `chown www-data:www-data` |
| อัปเดตโค้ด | สำรองข้อมูลก่อน แล้ว `sudo git pull` (ไม่กระทบฐานข้อมูล) |
| ลืมรหัสซุปเปอร์แอดมิน | `sudo -u www-data php setup.php` แล้วตอบ `y` |
| เปิดดูข้อมูล | คัดลอกไฟล์ `.db` ไปเปิดใน DB Browser for SQLite |

## 7. แก้ปัญหา

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| หน้าแอดมินไม่มีแถบเขียว | PHP ไม่ทำงาน หรือเขียน `data` ไม่ได้ ดู `/var/log/apache2/error.log` |
| `could not find driver` | ยังไม่ได้ติดตั้ง `php-sqlite3` |
| `attempt to write a readonly database` | สิทธิ์ `data` หรือไฟล์ `.db` ไม่ใช่ของ `www-data` |
| `database is locked` | เปิดไฟล์ค้างใน DB Browser ให้ปิดก่อน |
| เวลาในฐานข้อมูลไม่ตรง | ตั้งเขตเวลาเซิร์ฟเวอร์เป็น Asia/Bangkok |
