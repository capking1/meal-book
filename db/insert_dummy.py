# -*- coding: utf-8 -*-
"""더미 거래 내역 삽입 스크립트 (Docker 컨테이너 내부에서 실행)"""
import uuid
import mysql.connector

conn = mysql.connector.connect(
    host='db', port=3306,
    user='meal_user', password='meal_pass',
    database='meal_book', charset='utf8mb4'
)
cur = conn.cursor(dictionary=True)

# 팀/식당 ID 조회
cur.execute("SELECT id FROM MealTeams LIMIT 1")
team_id = cur.fetchone()['id']

cur.execute("SELECT id, name FROM MealRestaurants WHERE team_id = %s ORDER BY created_at", (team_id,))
rests = cur.fetchall()
rest1_id = rests[0]['id']
rest2_id = rests[1]['id']

print(f"팀: {team_id}")
print(f"식당1: {rest1_id} ({rests[0]['name']})")
print(f"식당2: {rest2_id} ({rests[1]['name']})")

nicknames = ['홍길동', '이영희', '박민수', '최지현', '김과장']
memos_spend = ['점심', '점심', '점심', '저녁', '야식']
amounts_spend = [7000, 8000, 9000, 10000, 8000]

data = []

def add(rest_id, tx_type, amount, nickname, memo, dt):
    data.append((str(uuid.uuid4()), team_id, rest_id, tx_type, amount, 0, nickname, memo, dt))

# ── 식당1 충전 ──
add(rest1_id, 'charge', 500000, '김과장', '4월 충전', '2026-04-01 09:00:00')
add(rest1_id, 'charge', 300000, '김과장', '5월 충전', '2026-05-01 09:00:00')
add(rest1_id, 'charge', 500000, '김과장', '6월 충전', '2026-06-02 09:00:00')

# ── 식당1: 4월 차감 ──
days_apr = ['04-02','04-03','04-03','04-07','04-08','04-09','04-10','04-10',
            '04-14','04-15','04-16','04-17','04-17','04-21','04-22','04-23','04-24','04-25']
times_apr = ['12:15','12:10','12:30','12:00','12:15','12:20','12:10','18:45',
             '12:00','12:10','12:30','12:15','21:00','12:20','12:00','12:30','12:10','18:30']
for i, (d, t) in enumerate(zip(days_apr, times_apr)):
    ni = i % 5
    add(rest1_id, 'spend', amounts_spend[ni], nicknames[ni], memos_spend[ni], f'2026-{d} {t}:00')

# ── 식당1: 5월 차감 ──
days_may = ['05-05','05-05','05-06','05-06','05-07','05-08','05-09','05-12','05-13','05-13',
            '05-14','05-15','05-19','05-20','05-21','05-21','05-22','05-26','05-27','05-28']
times_may = ['12:15','12:30','12:10','18:40','12:00','12:20','12:15','12:30','12:10','21:30',
             '12:00','12:20','12:15','12:00','12:30','18:30','12:10','12:00','12:20','12:15']
for i, (d, t) in enumerate(zip(days_may, times_may)):
    ni = i % 5
    add(rest1_id, 'spend', amounts_spend[ni], nicknames[ni], memos_spend[ni], f'2026-{d} {t}:00')

# ── 식당1: 6월 차감 ──
days_jun1 = ['06-02','06-02','06-03','06-03','06-04','06-05','06-05','06-06',
             '06-09','06-09','06-10','06-10','06-11']
times_jun1 = ['12:15','12:30','12:10','18:30','12:00','12:20','12:35','12:10',
              '12:00','21:00','12:15','12:30','12:10']
for i, (d, t) in enumerate(zip(days_jun1, times_jun1)):
    ni = i % 5
    add(rest1_id, 'spend', amounts_spend[ni], nicknames[ni], memos_spend[ni], f'2026-{d} {t}:00')

# ── 식당2 충전 ──
add(rest2_id, 'charge', 300000, '김과장', '4월 충전', '2026-04-01 09:30:00')
add(rest2_id, 'charge', 200000, '김과장', '5월 충전', '2026-05-01 09:30:00')
add(rest2_id, 'charge', 300000, '김과장', '6월 충전', '2026-06-02 09:30:00')

# ── 식당2: 4월 차감 ──
days_apr2 = ['04-02','04-03','04-04','04-07','04-08','04-09','04-14','04-14',
             '04-15','04-16','04-21','04-22','04-23','04-24','04-28']
times_apr2 = ['12:00','12:15','18:30','12:10','12:30','12:00','12:20','21:00',
              '12:15','12:00','12:30','12:10','18:45','12:00','12:20']
for i, (d, t) in enumerate(zip(days_apr2, times_apr2)):
    ni = i % 5
    add(rest2_id, 'spend', amounts_spend[ni], nicknames[ni], memos_spend[ni], f'2026-{d} {t}:00')

# ── 식당2: 5월 차감 ──
days_may2 = ['05-05','05-06','05-07','05-07','05-08','05-12','05-13','05-14',
             '05-15','05-15','05-19','05-20','05-21','05-22','05-26','05-27']
times_may2 = ['12:00','12:15','12:30','18:30','12:00','12:20','12:10','12:15',
              '12:30','21:00','12:00','12:20','12:10','12:00','18:30','12:30']
for i, (d, t) in enumerate(zip(days_may2, times_may2)):
    ni = i % 5
    add(rest2_id, 'spend', amounts_spend[ni], nicknames[ni], memos_spend[ni], f'2026-{d} {t}:00')

# ── 식당2: 6월 차감 ──
days_jun2 = ['06-02','06-03','06-03','06-04','06-05','06-05','06-06','06-06',
             '06-09','06-09','06-10','06-10','06-11']
times_jun2 = ['12:00','12:15','18:45','12:10','12:00','12:30','12:20','21:00',
              '12:10','12:30','12:00','12:20','18:30']
for i, (d, t) in enumerate(zip(days_jun2, times_jun2)):
    ni = i % 5
    add(rest2_id, 'spend', amounts_spend[ni], nicknames[ni], memos_spend[ni], f'2026-{d} {t}:00')

# 삽입
sql = """INSERT INTO MealTransactions (id, team_id, restaurant_id, type, amount, balance_after, user_nickname, memo, created_at)
         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
cur.executemany(sql, data)
conn.commit()
print(f"\n✅ {cur.rowcount}건 삽입 완료")

# 잔액 재계산
for rid in [rest1_id, rest2_id]:
    cur.execute("""UPDATE MealRestaurants SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type='charge' THEN amount ELSE -amount END), 0)
        FROM MealTransactions WHERE restaurant_id = %s
    ) WHERE id = %s""", (rid, rid))
conn.commit()

# 확인
cur.execute("SELECT name, balance FROM MealRestaurants WHERE team_id = %s", (team_id,))
for r in cur.fetchall():
    print(f"  {r['name']}: {r['balance']:,}원")

cur.close()
conn.close()
