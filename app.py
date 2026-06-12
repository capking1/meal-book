"""
e-식당 장부 (e-Meal Book) — Flask API Server
모바일 기반 급량비 식당 관리 서비스
"""

import os
import uuid
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, render_template, send_from_directory
import mysql.connector
from mysql.connector import pooling

# ──────────────────────────────────────────────
# Flask App 설정
# ──────────────────────────────────────────────
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['JSON_AS_ASCII'] = False

# ──────────────────────────────────────────────
# MySQL 연결 풀 설정
# ──────────────────────────────────────────────
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'meal_book'),
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_general_ci',
    'autocommit': True,
}

POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', '5'))
connection_pool = None


def init_pool():
    """MySQL 연결 풀 초기화"""
    global connection_pool
    try:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="meal_pool",
            pool_size=POOL_SIZE,
            pool_reset_session=True,
            **DB_CONFIG
        )
        print(f"[DB] MySQL 연결 풀 생성 완료 ({DB_CONFIG['host']}:{DB_CONFIG.get('port', 3306)})")
    except mysql.connector.Error as e:
        print(f"[DB] MySQL 연결 실패: {e}")
        connection_pool = None


def get_db():
    """연결 풀에서 커넥션 획득"""
    if connection_pool is None:
        init_pool()
    if connection_pool is None:
        raise ConnectionError('Cannot connect to MySQL database.')
    return connection_pool.get_connection()


def query(sql, params=None, fetchone=False):
    """SELECT 쿼리 실행 헬퍼"""
    conn = get_db()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params or ())
        result = cur.fetchone() if fetchone else cur.fetchall()
        cur.close()
        return result
    finally:
        conn.close()


def execute(sql, params=None):
    """INSERT/UPDATE/DELETE 쿼리 실행 헬퍼"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        conn.commit()
        affected = cur.rowcount
        cur.close()
        return affected
    finally:
        conn.close()


# ──────────────────────────────────────────────
# DB 테이블 자동 생성
# ──────────────────────────────────────────────
def init_db():
    """앱 시작 시 필요한 테이블을 자동 생성합니다."""
    tables = [
        """
        CREATE TABLE IF NOT EXISTS MealTeams (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
        """
        CREATE TABLE IF NOT EXISTS MealRestaurants (
            id VARCHAR(36) PRIMARY KEY,
            team_id VARCHAR(36) NOT NULL,
            name VARCHAR(100) NOT NULL,
            balance INT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            memo VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES MealTeams(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
        """
        CREATE TABLE IF NOT EXISTS MealTransactions (
            id VARCHAR(36) PRIMARY KEY,
            team_id VARCHAR(36) NOT NULL,
            restaurant_id VARCHAR(36) NOT NULL,
            type VARCHAR(10) NOT NULL,
            amount INT NOT NULL,
            balance_after INT NOT NULL,
            user_nickname VARCHAR(50) NOT NULL,
            memo VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES MealTeams(id) ON DELETE CASCADE,
            FOREIGN KEY (restaurant_id) REFERENCES MealRestaurants(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
    ]
    try:
        conn = get_db()
    except (ConnectionError, Exception) as e:
        print(f"[DB] [WARNING] MySQL 미연결 상태로 서버를 시작합니다. API 호출 시 DB 연결이 필요합니다. ({e})")
        return
    try:
        cur = conn.cursor()
        for ddl in tables:
            cur.execute(ddl)
        conn.commit()
        cur.close()
        print("[DB] 테이블 초기화 완료")
    finally:
        conn.close()


# ──────────────────────────────────────────────
# 유틸리티
# ──────────────────────────────────────────────
def new_id():
    return str(uuid.uuid4())


def json_serial(obj):
    """datetime JSON 직렬화"""
    if isinstance(obj, datetime):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    raise TypeError(f"Type {type(obj)} not serializable")


def ok(data=None, message="success", status=200):
    body = {'status': 'ok', 'message': message}
    if data is not None:
        body['data'] = data
    return jsonify(body), status


def err(message, status=400):
    return jsonify({'status': 'error', 'message': message}), status


@app.errorhandler(ConnectionError)
def handle_db_error(e):
    return jsonify({'status': 'error', 'message': 'DB 연결 오류: ' + str(e)}), 503


def serialize_row(row):
    """dict 내 datetime 객체를 문자열로 변환"""
    if row is None:
        return None
    out = {}
    for k, v in row.items():
        out[k] = v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, datetime) else v
    return out


def serialize_rows(rows):
    return [serialize_row(r) for r in rows]


# ──────────────────────────────────────────────
# API: 팀 (Teams)
# ──────────────────────────────────────────────
@app.route('/api/teams', methods=['POST'])
def create_team():
    """새 팀 개설"""
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return err('팀 이름을 입력해주세요.')
    if len(name) > 50:
        return err('팀 이름은 50자 이내여야 합니다.')

    # 중복 체크
    existing = query("SELECT id FROM MealTeams WHERE name = %s", (name,), fetchone=True)
    if existing:
        return err('이미 존재하는 팀 이름입니다.')

    team_id = new_id()
    execute("INSERT INTO MealTeams (id, name) VALUES (%s, %s)", (team_id, name))
    team = query("SELECT * FROM MealTeams WHERE id = %s", (team_id,), fetchone=True)
    return ok(serialize_row(team), '팀이 생성되었습니다.', 201)


@app.route('/api/teams/<team_id>', methods=['GET'])
def get_team(team_id):
    """팀 상세 조회"""
    team = query("SELECT * FROM MealTeams WHERE id = %s", (team_id,), fetchone=True)
    if not team:
        return err('존재하지 않는 팀입니다.', 404)
    return ok(serialize_row(team))


# ──────────────────────────────────────────────
# API: 식당 (Restaurants)
# ──────────────────────────────────────────────
@app.route('/api/teams/<team_id>/restaurants', methods=['GET'])
def list_restaurants(team_id):
    """팀의 식당 목록 조회 (이번 달 사용금액 포함)"""
    team = query("SELECT id FROM MealTeams WHERE id = %s", (team_id,), fetchone=True)
    if not team:
        return err('존재하지 않는 팀입니다.', 404)

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    restaurants = query(
        "SELECT * FROM MealRestaurants WHERE team_id = %s ORDER BY created_at DESC",
        (team_id,)
    )

    result = []
    for r in restaurants:
        # 이번 달 사용 합계
        month_spend = query(
            """SELECT COALESCE(SUM(amount), 0) AS total
               FROM MealTransactions
               WHERE restaurant_id = %s AND type = 'spend' AND created_at >= %s""",
            (r['id'], month_start), fetchone=True
        )
        # 최근 사용일
        last_use = query(
            """SELECT created_at FROM MealTransactions
               WHERE restaurant_id = %s AND type = 'spend'
               ORDER BY created_at DESC LIMIT 1""",
            (r['id'],), fetchone=True
        )

        row = serialize_row(r)
        row['month_spend'] = month_spend['total'] if month_spend else 0
        row['last_used'] = last_use['created_at'].strftime('%Y-%m-%d %H:%M:%S') if last_use and last_use['created_at'] else None
        result.append(row)

    return ok(result)


@app.route('/api/teams/<team_id>/restaurants', methods=['POST'])
def add_restaurant(team_id):
    """식당 신규 추가"""
    team = query("SELECT id FROM MealTeams WHERE id = %s", (team_id,), fetchone=True)
    if not team:
        return err('존재하지 않는 팀입니다.', 404)

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return err('식당명을 입력해주세요.')

    initial_balance = int(data.get('balance', 0) or 0)
    memo = (data.get('memo') or '').strip()
    nickname = (data.get('nickname') or '').strip()

    rest_id = new_id()

    conn = get_db()
    try:
        conn.autocommit = False
        cur = conn.cursor(dictionary=True)

        # 1. 식당 등록
        cur.execute(
            """INSERT INTO MealRestaurants (id, team_id, name, balance, memo)
               VALUES (%s, %s, %s, %s, %s)""",
            (rest_id, team_id, name, initial_balance, memo)
        )

        # 2. 초기 충전금(혹은 외상액)이 0이 아니면 거래 내역 기록
        if initial_balance != 0 and nickname:
            tx_id = new_id()
            tx_type = 'charge' if initial_balance > 0 else 'spend'
            tx_amount = abs(initial_balance)
            tx_memo = '초기 충전' if initial_balance > 0 else '초기 외상'
            cur.execute(
                """INSERT INTO MealTransactions (id, team_id, restaurant_id, type, amount, balance_after, user_nickname, memo)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (tx_id, team_id, rest_id, tx_type, tx_amount, initial_balance, nickname, tx_memo)
            )

        conn.commit()
        cur.close()
    except mysql.connector.Error as e:
        conn.rollback()
        return err(f'데이터베이스 오류: {e}', 500)
    finally:
        conn.close()

    restaurant = query("SELECT * FROM MealRestaurants WHERE id = %s", (rest_id,), fetchone=True)
    return ok(serialize_row(restaurant), '식당이 등록되었습니다.', 201)


@app.route('/api/teams/<team_id>/restaurants/<rest_id>', methods=['PUT'])
def update_restaurant(team_id, rest_id):
    """식당 정보 및 상태 수정 (팀 소속 검증 포함)"""
    restaurant = query(
        "SELECT * FROM MealRestaurants WHERE id = %s AND team_id = %s",
        (rest_id, team_id), fetchone=True
    )
    if not restaurant:
        return err('식당을 찾을 수 없습니다.', 404)

    data = request.get_json(silent=True) or {}
    name = data.get('name', restaurant['name'])
    status = data.get('status', restaurant['status'])
    memo = data.get('memo', restaurant['memo'])

    if status not in ('active', 'inactive'):
        return err("상태는 'active' 또는 'inactive'만 가능합니다.")

    execute(
        "UPDATE MealRestaurants SET name = %s, status = %s, memo = %s WHERE id = %s",
        (name, status, memo, rest_id)
    )
    updated = query("SELECT * FROM MealRestaurants WHERE id = %s", (rest_id,), fetchone=True)
    return ok(serialize_row(updated), '식당 정보가 수정되었습니다.')


@app.route('/api/teams/<team_id>/restaurants/<rest_id>', methods=['DELETE'])
def delete_restaurant(team_id, rest_id):
    """식당 삭제 (팀 소속 검증 포함)"""
    restaurant = query(
        "SELECT id FROM MealRestaurants WHERE id = %s AND team_id = %s",
        (rest_id, team_id), fetchone=True
    )
    if not restaurant:
        return err('식당을 찾을 수 없습니다.', 404)

    execute("DELETE FROM MealRestaurants WHERE id = %s", (rest_id,))
    return ok(message='식당이 삭제되었습니다.')


# ──────────────────────────────────────────────
# API: 충전 / 차감
# ──────────────────────────────────────────────
@app.route('/api/teams/<team_id>/restaurants/<rest_id>/charge', methods=['POST'])
def charge_restaurant(team_id, rest_id):
    """금액 충전"""
    data = request.get_json(silent=True) or {}
    amount = int(data.get('amount', 0) or 0)
    nickname = (data.get('nickname') or '').strip()
    memo = (data.get('memo') or '').strip()

    if amount <= 0:
        return err('충전 금액은 0보다 커야 합니다.')
    if not nickname:
        return err('별명을 입력해주세요.')

    conn = get_db()
    try:
        conn.autocommit = False
        cur = conn.cursor(dictionary=True)

        # 1. 식당 정보 조회 및 Row Locking
        cur.execute(
            "SELECT * FROM MealRestaurants WHERE id = %s AND team_id = %s FOR UPDATE",
            (rest_id, team_id)
        )
        restaurant = cur.fetchone()
        if not restaurant:
            conn.rollback()
            cur.close()
            return err('식당을 찾을 수 없습니다.', 404)
        if restaurant['status'] != 'active':
            conn.rollback()
            cur.close()
            return err('일시중지된 식당에는 충전할 수 없습니다.')

        # 2. 잔액 업데이트
        new_balance = restaurant['balance'] + amount
        cur.execute("UPDATE MealRestaurants SET balance = %s WHERE id = %s", (new_balance, rest_id))

        # 3. 거래 내역 삽입
        tx_id = new_id()
        cur.execute(
            """INSERT INTO MealTransactions (id, team_id, restaurant_id, type, amount, balance_after, user_nickname, memo)
               VALUES (%s, %s, %s, 'charge', %s, %s, %s, %s)""",
            (tx_id, team_id, rest_id, amount, new_balance, nickname, memo)
        )

        conn.commit()
        cur.close()
        return ok({
            'transaction_id': tx_id,
            'new_balance': new_balance,
            'amount': amount
        }, f'{amount:,}원이 충전되었습니다.')
    except mysql.connector.Error as e:
        conn.rollback()
        return err(f'데이터베이스 오류: {e}', 500)
    finally:
        conn.close()


@app.route('/api/teams/<team_id>/restaurants/<rest_id>/spend', methods=['POST'])
def spend_restaurant(team_id, rest_id):
    """금액 차감"""
    data = request.get_json(silent=True) or {}
    amount = int(data.get('amount', 0) or 0)
    nickname = (data.get('nickname') or '').strip()
    memo = (data.get('memo') or '').strip()

    if amount <= 0:
        return err('차감 금액은 0보다 커야 합니다.')
    if not nickname:
        return err('별명을 입력해주세요.')

    conn = get_db()
    try:
        conn.autocommit = False
        cur = conn.cursor(dictionary=True)

        # 1. 식당 정보 조회 및 Row Locking
        cur.execute(
            "SELECT * FROM MealRestaurants WHERE id = %s AND team_id = %s FOR UPDATE",
            (rest_id, team_id)
        )
        restaurant = cur.fetchone()
        if not restaurant:
            conn.rollback()
            cur.close()
            return err('식당을 찾을 수 없습니다.', 404)
        if restaurant['status'] != 'active':
            conn.rollback()
            cur.close()
            return err('일시중지된 식당에서는 차감할 수 없습니다.')

        # 2. 잔액 업데이트
        new_balance = restaurant['balance'] - amount
        cur.execute("UPDATE MealRestaurants SET balance = %s WHERE id = %s", (new_balance, rest_id))

        # 3. 거래 내역 삽입
        tx_id = new_id()
        cur.execute(
            """INSERT INTO MealTransactions (id, team_id, restaurant_id, type, amount, balance_after, user_nickname, memo)
               VALUES (%s, %s, %s, 'spend', %s, %s, %s, %s)""",
            (tx_id, team_id, rest_id, amount, new_balance, nickname, memo)
        )

        conn.commit()
        cur.close()
        return ok({
            'transaction_id': tx_id,
            'new_balance': new_balance,
            'amount': amount
        }, f'{amount:,}원이 차감되었습니다.')
    except mysql.connector.Error as e:
        conn.rollback()
        return err(f'데이터베이스 오류: {e}', 500)
    finally:
        conn.close()


# ──────────────────────────────────────────────
# API: 거래 내역
# ──────────────────────────────────────────────
@app.route('/api/teams/<team_id>/transactions', methods=['GET'])
def list_transactions(team_id):
    """통합 거래 내역 조회 (필터링 및 검색 지원)"""
    team = query("SELECT id FROM MealTeams WHERE id = %s", (team_id,), fetchone=True)
    if not team:
        return err('존재하지 않는 팀입니다.', 404)

    # 필터 파라미터
    tx_type = request.args.get('type', '')         # 'charge' / 'spend' / '' (전체)
    rest_id = request.args.get('restaurant_id', '')
    nickname = request.args.get('nickname', '')
    limit = min(int(request.args.get('limit', 50)), 200)
    offset = int(request.args.get('offset', 0))

    sql = """
        SELECT t.*, r.name AS restaurant_name
        FROM MealTransactions t
        JOIN MealRestaurants r ON t.restaurant_id = r.id
        WHERE t.team_id = %s
    """
    params = [team_id]

    if tx_type in ('charge', 'spend'):
        sql += " AND t.type = %s"
        params.append(tx_type)
    if rest_id:
        sql += " AND t.restaurant_id = %s"
        params.append(rest_id)
    if nickname:
        sql += " AND t.user_nickname LIKE %s"
        params.append(f'%{nickname}%')

    sql += " ORDER BY t.created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    rows = query(sql, params)
    return ok(serialize_rows(rows))


# ──────────────────────────────────────────────
# API: 대시보드 통계
# ──────────────────────────────────────────────
@app.route('/api/teams/<team_id>/stats', methods=['GET'])
def team_stats(team_id):
    """Chart.js 연동용 대시보드 통계"""
    team = query("SELECT id FROM MealTeams WHERE id = %s", (team_id,), fetchone=True)
    if not team:
        return err('존재하지 않는 팀입니다.', 404)

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 1) 요약 지표
    total_balance = query(
        "SELECT COALESCE(SUM(balance), 0) AS total FROM MealRestaurants WHERE team_id = %s",
        (team_id,), fetchone=True
    )
    restaurant_count = query(
        "SELECT COUNT(*) AS cnt FROM MealRestaurants WHERE team_id = %s",
        (team_id,), fetchone=True
    )
    month_total_spend = query(
        """SELECT COALESCE(SUM(amount), 0) AS total
           FROM MealTransactions
           WHERE team_id = %s AND type = 'spend' AND created_at >= %s""",
        (team_id, month_start), fetchone=True
    )
    month_total_charge = query(
        """SELECT COALESCE(SUM(amount), 0) AS total
           FROM MealTransactions
           WHERE team_id = %s AND type = 'charge' AND created_at >= %s""",
        (team_id, month_start), fetchone=True
    )

    summary = {
        'total_balance': total_balance['total'],
        'restaurant_count': restaurant_count['cnt'],
        'month_spend': month_total_spend['total'],
        'month_charge': month_total_charge['total'],
    }

    # 2) 식당별 지출 비중 (도넛 차트)
    spend_by_restaurant = query(
        """SELECT r.name, COALESCE(SUM(t.amount), 0) AS total
           FROM MealRestaurants r
           LEFT JOIN MealTransactions t ON t.restaurant_id = r.id AND t.type = 'spend' AND t.created_at >= %s
           WHERE r.team_id = %s
           GROUP BY r.id, r.name
           ORDER BY total DESC""",
        (month_start, team_id)
    )

    # 3) 최근 6개월 월별 지출 추이 (라인 차트)
    monthly_spend = []
    for i in range(5, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if m_start.month == 12:
            m_end = m_start.replace(year=m_start.year + 1, month=1)
        else:
            m_end = m_start.replace(month=m_start.month + 1)
        row = query(
            """SELECT COALESCE(SUM(amount), 0) AS total
               FROM MealTransactions
               WHERE team_id = %s AND type = 'spend' AND created_at >= %s AND created_at < %s""",
            (team_id, m_start, m_end), fetchone=True
        )
        monthly_spend.append({
            'month': m_start.strftime('%Y-%m'),
            'total': row['total']
        })

    # 4) 최근 7일 일별 지출 (바 차트)
    daily_spend = []
    for i in range(6, -1, -1):
        d_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        d_end = d_start + timedelta(days=1)
        row = query(
            """SELECT COALESCE(SUM(amount), 0) AS total
               FROM MealTransactions
               WHERE team_id = %s AND type = 'spend' AND created_at >= %s AND created_at < %s""",
            (team_id, d_start, d_end), fetchone=True
        )
        daily_spend.append({
            'date': d_start.strftime('%m/%d'),
            'total': row['total']
        })

    return ok({
        'summary': summary,
        'spend_by_restaurant': serialize_rows(spend_by_restaurant),
        'monthly_spend': monthly_spend,
        'daily_spend': daily_spend,
    })


# ──────────────────────────────────────────────
# API: 별명 변경 (과거 내역 동기화)
# ──────────────────────────────────────────────
@app.route('/api/teams/<team_id>/nickname', methods=['PUT'])
def update_nickname(team_id):
    """별명 변경 시 과거 거래 내역도 함께 업데이트"""
    data = request.get_json(silent=True) or {}
    old_nickname = (data.get('old_nickname') or '').strip()
    new_nickname = (data.get('new_nickname') or '').strip()

    if not old_nickname or not new_nickname:
        return err('기존 별명과 새 별명을 모두 입력해주세요.')
    if old_nickname == new_nickname:
        return ok(message='변경사항이 없습니다.')

    affected = execute(
        "UPDATE MealTransactions SET user_nickname = %s WHERE team_id = %s AND user_nickname = %s",
        (new_nickname, team_id, old_nickname)
    )
    return ok({'updated_count': affected}, f'별명이 변경되었습니다. ({affected}건 내역 업데이트)')


# ──────────────────────────────────────────────
# SPA 라우팅 — 모든 페이지 뷰에 index.html 반환
# ──────────────────────────────────────────────
@app.route('/')
@app.route('/home')
@app.route('/invite/<team_id>')
@app.route('/manager')
@app.route('/manager/<path:subpath>')
@app.route('/member')
@app.route('/member/<path:subpath>')
@app.route('/settings')
def spa_routes(**kwargs):
    return render_template('index.html')


# ──────────────────────────────────────────────
# 앱 시작
# ──────────────────────────────────────────────
if __name__ == '__main__':
    init_pool()
    init_db()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
