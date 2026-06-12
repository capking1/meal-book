# [기획서] e-식당 장부 (e-Meal Book) 구축 계획

> 본 기획서는 모바일 환경에서 복잡한 인증 로그인 없이 간편하게 팀원들이 급량비를 차감하고, 담당자가 식당별 장부 잔액을 충전 및 관리할 수 있는 독립 프로젝트의 기획 및 구현 계획을 다룹니다.

---

## 1. 서비스 개요

- **서비스명**: e-식당 장부 (e-Meal Book)
- **개발 형태**: 기존 '경남 e-장부' 시스템과 별개로 구축되는 독립적인 신규 Python Flask 웹 애플리케이션
- **컨셉**: 부서/팀 단위로 인근 식당들과 장부(선충전 방식) 계약을 맺고 식비를 정산할 때, 종이 장부나 엑셀 입력 없이 모바일 기기 터치 몇 번으로 잔액을 차감하고 충전하는 간이 재무 관리 시스템

### 핵심 가치

| 가치 | 설명 |
|------|------|
| **무인증 간편 진입** | 회원가입/로그인 없이 **'팀 가입(초대 링크 또는 새 팀 개설)'** + **'별명 입력'**만으로 즉시 이용 |
| **역할 구분 없는 기능 선택** | 고정된 담당자/팀원 역할 없이, 메인 화면에서 **하고자 하는 기능을 버튼으로 선택** |
| **Mobile-First UX** | 계산대 앞에서 한 손으로 빠르게 처리할 수 있는 큼직한 버튼과 퀵 금액 버튼 |
| **실시간 잔액 동기화** | 잔액 부족·초과 사용(마이너스) 상태를 즉각 시각화 |

---

## 2. 사용자 모델

> **고정 역할 없음** — 모든 팀 구성원이 동일한 자격으로 서비스를 이용하며, 메인 화면에서 기능 버튼을 눌러 원하는 작업을 수행합니다.

- **급량비 관리 기능**: 식당 등록, 잔액 충전, 식당 상태 관리, 전체 거래 내역 조회 및 통계
- **식대 차감 기능**: 식당 선택 → 식사 금액 차감, 본인 사용 내역 조회

---

## 3. 화면 구성 및 기능 명세

### 3.1. 진입 화면 (`/`)

#### 팀 정보가 없는 경우 (최초 접속)
- 서비스 로고 및 소개 문구
- **[새 팀 개설하기]** 버튼: 팀 이름 + 별명 입력 → 즉시 팀 생성 및 초대 링크 발급
- 안내 문구: "초대 링크를 받으셨나요? 담당자에게 링크를 요청하세요"

#### 팀 정보가 있는 경우 → 자동으로 메인 홈(`/home`)으로 이동

### 3.2. 초대 링크 진입 (`/invite/<team_id>`)

- **팀 정보 없음**: 별명 입력 → 가입 처리 → 메인 홈 이동
- **동일 팀 가입 상태**: 즉시 메인 홈으로 리다이렉트
- **다른 팀 가입 상태**: "기존 팀 'XXX'에서 새 팀 'OOO'으로 전환하시겠습니까?" 경고 → 동의 시 기존 세션 파괴 후 새 팀 가입

### 3.3. 메인 홈 (`/home`) — 기능 선택 허브

- **팀 이름 표시**
- **[🏪 급량비 관리]** 버튼 → `/manager`
- **[🍚 식대 차감]** 버튼 → `/member`
- **[📋 초대 링크 복사]** 버튼
- **⚙️ 설정** → `/settings`

### 3.4. 급량비 관리 화면군

| 화면 | 경로 | 기능 |
|------|------|------|
| 관리 대시보드 | `/manager` | 전체 잔액 합계, 등록 식당 수, 이번 달 사용 금액, Chart.js 차트 |
| 식당 추가 | `/manager/add` | 식당명, 초기 충전금(선택), 메모 입력 후 등록 |
| 식당 목록 | `/manager/restaurants` | 카드 뷰 (잔액, 이번 달 사용액, 최근 사용일) + [충전/내역/수정/중지/삭제] |
| 금액 충전 | `/manager/charge/[id]` | 직접 입력 또는 퀵 버튼(+1만/+5만/+10만/+20만), 충전 사유 메모 |
| 통합 내역 | `/manager/history` | 팀 전체 거래 로그 타임라인, 식당별·유형별 필터, 별명 검색 |

### 3.5. 식대 차감 화면군

| 화면 | 경로 | 기능 |
|------|------|------|
| 식당 선택 | `/member` | 식당 카드 리스트, 잔액 마이너스 시 붉은색 경고 |
| 금액 차감 | `/member/spend/[id]` | 직접 입력 또는 퀵 버튼(7,000/8,000/9,000/10,000), 용도 퀵 선택(점심/저녁/야식) |
| 내 사용 내역 | `/member/history` | 본인 별명 기준 차감 기록 타임라인 |

### 3.6. 공통 설정 (`/settings`)

- **별명 수정**: 현재 팀에서 사용하는 별명 변경
- **팀 탈퇴**: 로컬 세션 완전 삭제 → 진입 화면(`/`)으로 이동

---

## 4. 기술 스택

| 영역 | 기술 |
|------|------|
| **백엔드** | Python / Flask |
| **프론트엔드** | Vanilla HTML5 / Vanilla JS / Vanilla CSS |
| **데이터베이스** | MySQL (`mysql-connector-python`) |
| **시각화** | Chart.js 4.x (CDN) |
| **배포** | Docker + GitHub Actions |

---

## 5. 데이터베이스 스키마 (MySQL)

```sql
CREATE TABLE IF NOT EXISTS MealTeams (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS MealRestaurants (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    balance INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    memo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES MealTeams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS MealTransactions (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id VARCHAR(36) NOT NULL,
    type VARCHAR(10) NOT NULL,       -- 'charge' / 'spend'
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    user_nickname VARCHAR(50) NOT NULL,
    memo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES MealRestaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 6. API 엔드포인트

| Method | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/teams` | 새 팀 개설 |
| `GET` | `/api/teams/<team_id>` | 팀 상세 조회 |
| `GET` | `/api/teams/<team_id>/restaurants` | 식당 목록 (잔액, 이번 달 사용금액 포함) |
| `POST` | `/api/teams/<team_id>/restaurants` | 식당 추가 |
| `PUT` | `/api/restaurants/<id>` | 식당 정보·상태 수정 |
| `DELETE` | `/api/restaurants/<id>` | 식당 삭제 |
| `POST` | `/api/restaurants/<id>/charge` | 금액 충전 |
| `POST` | `/api/restaurants/<id>/spend` | 금액 차감 |
| `GET` | `/api/teams/<team_id>/transactions` | 통합 거래 내역 (필터·검색) |
| `GET` | `/api/teams/<team_id>/stats` | 대시보드 통계 데이터 |

---

## 7. 클라이언트 세션 (localStorage)

```json
{
  "teamId": "uuid-string",
  "teamName": "OO과",
  "nickname": "홍길동"
}
```

> 역할(role) 저장 없음. 기능은 매번 메인 홈에서 버튼으로 선택.

---

## 8. UI/UX 디자인 방향

- **Curated Theme**: HSL 기반 다크 모드, 카드에 섀도우·트랜지션으로 프리미엄 감성
- **Status Contrast**: 잔액 충분 → Emerald Green / 잔액 부족 → Coral Red 그라데이션
- **Micro-Animations**: 버튼 Scale Down/Up 바운스, 페이지 전환 Fade-In/Slide-Up
- **Chart.js 차트**: 식당별 지출 비중(도넛), 월별 추이(라인), 일별 패턴(바)

---

## 9. CI/CD 배포 계획

### 개발/테스트 (외부 무료 클라우드)
- Dockerfile 기반 자동 빌드·배포 (Render, Koyeb, Cloudtype 등)

### 실서비스 (내부 DMZ 리눅스 서버)
- GitHub Actions Self-hosted Runner 아웃바운드 풀 배포 (인바운드 포트 개방 불필요)

---

## 10. 프로젝트 파일 구조

```
d:\meal\
├── app.py                    # Flask 메인 앱 (API + SPA 라우팅)
├── requirements.txt          # Python 의존성
├── Dockerfile                # 컨테이너 빌드용
├── templates/
│   └── index.html            # SPA 진입점 (유일한 HTML)
├── static/
│   ├── css/
│   │   └── style.css         # CSS 디자인 시스템
│   └── js/
│       └── app.js            # SPA 라우터 & 비즈니스 로직
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD 파이프라인
└── docs/
    └── 기획서_e식당장부.md     # 본 기획서
```
