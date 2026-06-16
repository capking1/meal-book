/**
 * e-식당 장부 (e-Meal Book) — SPA Frontend
 * Vanilla JS Client Router + Business Logic
 */

// ──────────────────────────────────────────────
// Session Manager (localStorage)
// ──────────────────────────────────────────────
const Session = {
    KEY: 'emealbook_session',

    get() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY)) || null;
        } catch { return null; }
    },

    set(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },

    isLoggedIn() {
        const s = this.get();
        return s && s.teamId && s.nickname;
    },

    getTeamId()  { return this.get()?.teamId || ''; },
    getTeamName(){ return this.get()?.teamName || ''; },
    getNickname(){ return this.get()?.nickname || ''; },
    getMyTransactions() { return this.get()?.myTransactions || []; },
    addMyTransaction(txId) {
        const s = this.get();
        if (s) {
            s.myTransactions = s.myTransactions || [];
            s.myTransactions.push(txId);
            this.set(s);
        }
    }
};


// ──────────────────────────────────────────────
// API Helper
// ──────────────────────────────────────────────
const API = {
    async request(method, url, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(url, opts);
            const data = await res.json();
            if (!res.ok || data.status === 'error') {
                throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
            }
            return data;
        } catch (e) {
            if (e.message === 'Failed to fetch') {
                throw new Error('서버에 연결할 수 없습니다.');
            }
            throw e;
        }
    },

    get(url)        { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); },
    put(url, body)  { return this.request('PUT', url, body); },
    delete(url)     { return this.request('DELETE', url); },
};


// ──────────────────────────────────────────────
// Toast Notification
// ──────────────────────────────────────────────
const Toast = {
    container: null,

    init() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        this.container.appendChild(el);

        setTimeout(() => {
            el.classList.add('hiding');
            setTimeout(() => el.remove(), 300);
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg)   { this.show(msg, 'error'); },
    info(msg)    { this.show(msg, 'info'); },
};


// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────
function formatMoney(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('ko-KR');
}

function formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function $(selector) { return document.querySelector(selector); }


// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────
const Router = {
    routes: {},

    register(path, handler) {
        this.routes[path] = handler;
    },

    navigate(path, replace = false) {
        if (replace) {
            history.replaceState(null, '', path);
        } else {
            history.pushState(null, '', path);
        }
        this.resolve();
    },

    resolve() {
        const path = location.pathname;
        const app = document.getElementById('app');

        // Find matching route
        for (const [pattern, handler] of Object.entries(this.routes)) {
            const params = this.matchRoute(pattern, path);
            if (params !== null) {
                app.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'page-enter';
                app.appendChild(wrapper);
                handler(wrapper, params);
                window.scrollTo(0, 0);
                return;
            }
        }

        // 404 fallback → home or landing
        if (Session.isLoggedIn()) {
            this.navigate('/home', true);
        } else {
            this.navigate('/', true);
        }
    },

    matchRoute(pattern, path) {
        // Convert pattern like '/invite/:teamId' to regex
        const paramNames = [];
        const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
            paramNames.push(name);
            return '([^/]+)';
        });
        const regex = new RegExp(`^${regexStr}$`);
        const match = path.match(regex);
        if (!match) return null;

        const params = {};
        paramNames.forEach((name, i) => {
            params[name] = match[i + 1];
        });
        return params;
    },

    init() {
        window.addEventListener('popstate', () => this.resolve());
        this.resolve();
    }
};


// ──────────────────────────────────────────────
// Modal Helper
// ──────────────────────────────────────────────
function showModal(title, message, confirmText, cancelText, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content">
            <h2>${escapeHtml(title)}</h2>
            <p>${message}</p>
            <div class="modal-actions">
                <button class="btn btn-ghost cancel-btn">${escapeHtml(cancelText || '취소')}</button>
                <button class="btn btn-primary confirm-btn">${escapeHtml(confirmText || '확인')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.confirm-btn').addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function showEditModal(title, amount, memo, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content">
            <h2>${escapeHtml(title)}</h2>
            <div class="form-group" style="text-align: left; margin-top: 16px;">
                <label>금액 (원)</label>
                <input type="number" class="input" id="edit-modal-amount" value="${amount}" min="0">
            </div>
            <div class="form-group" style="text-align: left; margin-top: 12px; margin-bottom: 20px;">
                <label>메모 (선택)</label>
                <input type="text" class="input" id="edit-modal-memo" value="${escapeHtml(memo)}" maxlength="255">
            </div>
            <div class="modal-actions">
                <button class="btn btn-ghost cancel-btn">취소</button>
                <button class="btn btn-primary confirm-btn">저장</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.confirm-btn').addEventListener('click', () => {
        const newAmount = parseInt(document.getElementById('edit-modal-amount').value) || 0;
        const newMemo = document.getElementById('edit-modal-memo').value.trim();
        
        if (newAmount <= 0) {
            Toast.error('올바른 금액을 입력해주세요.');
            return;
        }
        
        overlay.remove();
        onConfirm(newAmount, newMemo);
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}


// ══════════════════════════════════════════════
// PAGE: Landing (/)
// ══════════════════════════════════════════════
Router.register('/', (container) => {
    // 이미 로그인된 상태면 홈으로
    if (Session.isLoggedIn()) {
        Router.navigate('/home', true);
        return;
    }

    container.innerHTML = `
        <div class="landing">
            <div class="logo">🍱</div>
            <h1>e-식당 장부</h1>
            <p class="subtitle">우리 팀의 식당 장부를<br>간편하게 관리하세요</p>

            <div class="landing-form">
                <div class="form-group">
                    <label>팀 이름</label>
                    <input type="text" class="input" id="input-team-name"
                           placeholder="예: 총무과, 개발팀" maxlength="50" autocomplete="off">
                </div>
                <div class="form-group">
                    <label>내 별명</label>
                    <input type="text" class="input" id="input-nickname"
                           placeholder="예: 홍길동, GD" maxlength="50" autocomplete="off">
                </div>
                <button class="btn btn-primary btn-full btn-lg" id="btn-create-team">
                    🚀 팀 개설하고 시작하기
                </button>

                <div class="divider">또는</div>
                <p class="text-muted text-sm">초대 링크를 받으셨나요?<br>담당자에게 링크를 요청하세요</p>
            </div>
        </div>
    `;

    document.getElementById('btn-create-team').addEventListener('click', async () => {
        const teamName = document.getElementById('input-team-name').value.trim();
        const nickname = document.getElementById('input-nickname').value.trim();

        if (!teamName) { Toast.error('팀 이름을 입력해주세요.'); return; }
        if (!nickname) { Toast.error('별명을 입력해주세요.'); return; }

        try {
            const res = await API.post('/api/teams', { name: teamName });
            Session.set({
                teamId: res.data.id,
                teamName: res.data.name,
                nickname: nickname,
            });
            Toast.success('팀이 생성되었습니다!');
            Router.navigate('/home');
        } catch (e) {
            Toast.error(e.message);
        }
    });
});


// ══════════════════════════════════════════════
// PAGE: Invite (/invite/:teamId)
// ══════════════════════════════════════════════
Router.register('/invite/:teamId', async (container, params) => {
    const { teamId } = params;

    // 팀 정보 확인
    let team;
    try {
        const res = await API.get(`/api/teams/${teamId}`);
        team = res.data;
    } catch {
        container.innerHTML = `
            <div class="landing">
                <div class="logo">❌</div>
                <h1>유효하지 않은 링크</h1>
                <p class="subtitle">존재하지 않는 팀의 초대 링크입니다.</p>
                <button class="btn btn-primary" onclick="Router.navigate('/')">처음으로</button>
            </div>
        `;
        return;
    }

    const session = Session.get();

    // 이미 같은 팀에 가입됨
    if (session && session.teamId === teamId) {
        Router.navigate('/home', true);
        return;
    }

    // 다른 팀에 가입됨 → 전환 경고
    if (session && session.teamId && session.teamId !== teamId) {
        showModal(
            '팀 전환',
            `기존 가입된 팀 <strong>'${escapeHtml(session.teamName)}'</strong>이(가) 있습니다.<br>
             새로운 팀 <strong>'${escapeHtml(team.name)}'</strong>(으)로 전환하시겠습니까?<br><br>
             <span style="color:var(--warning); font-size:0.85rem;">기존 팀의 정보는 이 기기에서 지워집니다.</span>`,
            '전환하기',
            '취소',
            () => {
                Session.clear();
                renderInviteForm(container, team);
            }
        );
        // 일단 현재 화면은 빈 상태
        container.innerHTML = '';
        return;
    }

    // 팀 정보 없음 → 바로 가입 폼
    renderInviteForm(container, team);
});

function renderInviteForm(container, team) {
    container.innerHTML = `
        <div class="landing">
            <div class="logo">🤝</div>
            <h1>${escapeHtml(team.name)}</h1>
            <p class="subtitle">팀에 초대되었습니다!<br>별명을 입력하고 시작하세요</p>

            <div class="landing-form">
                <div class="form-group">
                    <label>내 별명</label>
                    <input type="text" class="input" id="invite-nickname"
                           placeholder="예: 홍길동, GD" maxlength="50" autocomplete="off">
                </div>
                <button class="btn btn-primary btn-full btn-lg" id="btn-join">
                    🎉 시작하기
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-join').addEventListener('click', () => {
        const nickname = document.getElementById('invite-nickname').value.trim();
        if (!nickname) { Toast.error('별명을 입력해주세요.'); return; }

        Session.set({
            teamId: team.id,
            teamName: team.name,
            nickname: nickname,
        });
        Toast.success(`${team.name} 팀에 가입했습니다!`);
        Router.navigate('/home');
    });
}


// ══════════════════════════════════════════════
// PAGE: Home Hub (/home)
// ══════════════════════════════════════════════
Router.register('/home', (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }

    const teamName = Session.getTeamName();
    const nickname = Session.getNickname();
    const teamId = Session.getTeamId();
    const inviteLink = `${location.origin}/invite/${teamId}`;

    container.innerHTML = `
        <div class="home-header">
            <div class="team-badge">👥 ${escapeHtml(teamName)}</div>
            <h1>e-식당 장부</h1>
            <p class="greeting">${escapeHtml(nickname)}님, 안녕하세요!</p>
        </div>

        <div class="feature-card" id="btn-manager">
            <div class="feature-icon manager">🏪</div>
            <div class="feature-text">
                <h3>급량비 관리</h3>
                <p>식당 등록 · 잔액 충전 · 통계 확인</p>
            </div>
        </div>

        <div class="feature-card" id="btn-member">
            <div class="feature-icon member">🍚</div>
            <div class="feature-text">
                <h3>식대 차감</h3>
                <p>식당 선택 · 식사 금액 차감하기</p>
            </div>
        </div>

        <button class="btn btn-ghost btn-full mb-12" id="btn-invite">✉️ 팀원 초대하기</button>
        <button class="btn btn-ghost btn-full" id="btn-settings">⚙️ 설정</button>
    `;

    document.getElementById('btn-manager').addEventListener('click', () => Router.navigate('/manager'));
    document.getElementById('btn-member').addEventListener('click', () => Router.navigate('/member'));
    document.getElementById('btn-settings').addEventListener('click', () => Router.navigate('/settings'));

    document.getElementById('btn-invite').addEventListener('click', async () => {
        const shareData = {
            title: 'e-식당 장부 초대',
            text: `'${teamName}' 팀의 식당 장부에 초대합니다. 아래 링크를 눌러 별명을 등록하고 시작하세요!`,
            url: inviteLink,
        };

        // Web Share API는 HTTPS에서만 지원됩니다.
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (e) {
                // 사용자가 공유 창을 수동으로 취소한 경우가 아닌 경우에만 복사로 대체
                if (e.name === 'AbortError') return;
            }
        }
        
        // 지원하지 않거나 실패 시 클립보드 복사 수행
        copyToClipboard(inviteLink);
    });

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showModal(
                    '초대 링크 복사 완료',
                    `초대 링크가 클립보드에 복사되었습니다.<br><br><strong>카카오톡, 슬랙, 라인 등 메신저 앱 대화방에 붙여넣기(Ctrl+V 또는 길게 누르기)</strong>하여 팀원을 초대해 주세요!`,
                    '확인',
                    '닫기',
                    () => {}
                );
            }).catch(() => {
                fallbackCopyToClipboard(text);
            });
        } else {
            fallbackCopyToClipboard(text);
        }
    }

    function fallbackCopyToClipboard(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showModal(
                    '초대 링크 복사 완료',
                    `초대 링크가 클립보드에 복사되었습니다.<br><br><strong>카카오톡, 슬랙, 라인 등 메신저 앱 대화방에 붙여넣기(Ctrl+V 또는 길게 누르기)</strong>하여 팀원을 초대해 주세요!`,
                    '확인',
                    '닫기',
                    () => {}
                );
            } else {
                Toast.error('초대 링크 복사에 실패했습니다.');
            }
        } catch (err) {
            Toast.error('초대 링크 복사에 실패했습니다.');
        }
        document.body.removeChild(ta);
    }

});


// ══════════════════════════════════════════════
// PAGE: Manager Dashboard (/manager)
// ══════════════════════════════════════════════
Router.register('/manager', async (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>급량비 관리</h1>
        </div>
        <div class="loading-screen"><div class="spinner"></div><span>데이터 불러오는 중...</span></div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/home'));

    try {
        const statsRes = await API.get(`/api/teams/${teamId}/stats`);
        const stats = statsRes.data;
        const s = stats.summary;

        container.innerHTML = `
            <div class="page-header">
                <button class="back-btn" id="back-btn">←</button>
                <h1>급량비 관리</h1>
            </div>

            <div class="stat-grid">
                <div class="stat-card ${s.total_balance >= 0 ? 'positive' : 'negative'}">
                    <div class="stat-value">${formatMoney(s.total_balance)}</div>
                    <div class="stat-label">전체 잔액 (원)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${s.restaurant_count}</div>
                    <div class="stat-label">등록 식당</div>
                </div>
                <div class="stat-card negative">
                    <div class="stat-value">${formatMoney(s.month_spend)}</div>
                    <div class="stat-label">이번 달 사용</div>
                </div>
                <div class="stat-card positive">
                    <div class="stat-value">${formatMoney(s.month_charge)}</div>
                    <div class="stat-label">이번 달 충전</div>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px; margin-bottom:28px;">
                <button class="btn btn-primary btn-full" id="btn-rest-list">📋 식당 목록 관리</button>
                <button class="btn btn-ghost btn-full" id="btn-history">📜 통합 내역 조회</button>
            </div>

            <div class="chart-container" id="chart-donut-wrap">
                <h3>🍩 식당별 지출 비중</h3>
                <canvas id="chart-donut"></canvas>
            </div>

            <div class="chart-container" id="chart-line-wrap">
                <h3>📈 월별 지출 추이</h3>
                <canvas id="chart-line"></canvas>
            </div>

            <div class="chart-container" id="chart-bar-wrap">
                <h3>📊 최근 7일 지출</h3>
                <canvas id="chart-bar"></canvas>
            </div>
        `;

        document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/home'));
        document.getElementById('btn-rest-list').addEventListener('click', () => Router.navigate('/manager/restaurants'));
        document.getElementById('btn-history').addEventListener('click', () => Router.navigate('/manager/history'));

        // Charts
        renderCharts(stats);

    } catch (e) {
        container.innerHTML += `<p class="text-center text-muted mt-20">${e.message}</p>`;
    }
});

function renderCharts(stats) {
    if (typeof Chart === 'undefined') return;

    const chartColors = [
        'hsl(230, 85%, 62%)', 'hsl(270, 75%, 62%)', 'hsl(155, 70%, 45%)',
        'hsl(38, 95%, 55%)', 'hsl(0, 80%, 58%)', 'hsl(190, 80%, 50%)',
        'hsl(320, 70%, 55%)', 'hsl(60, 80%, 50%)',
    ];

    Chart.defaults.color = 'hsl(220, 15%, 45%)';
    Chart.defaults.borderColor = 'hsla(220, 20%, 20%, 0.08)';
    Chart.defaults.font.family = 'Inter, sans-serif';

    // Donut
    const donutData = stats.spend_by_restaurant || [];
    if (donutData.length > 0 && donutData.some(d => d.total > 0)) {
        new Chart(document.getElementById('chart-donut'), {
            type: 'doughnut',
            data: {
                labels: donutData.map(d => d.name),
                datasets: [{
                    data: donutData.map(d => d.total),
                    backgroundColor: chartColors.slice(0, donutData.length),
                    borderWidth: 0,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } }
            }
        });
    } else {
        document.getElementById('chart-donut-wrap').style.display = 'none';
    }

    // Line (Monthly)
    const monthlyData = stats.monthly_spend || [];
    new Chart(document.getElementById('chart-line'), {
        type: 'line',
        data: {
            labels: monthlyData.map(d => d.month),
            datasets: [{
                label: '지출액',
                data: monthlyData.map(d => d.total),
                borderColor: 'hsl(230, 85%, 62%)',
                backgroundColor: 'hsla(230, 85%, 62%, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2.5,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => formatMoney(v) } }
            }
        }
    });

    // Bar (Daily)
    const dailyData = stats.daily_spend || [];
    new Chart(document.getElementById('chart-bar'), {
        type: 'bar',
        data: {
            labels: dailyData.map(d => d.date),
            datasets: [{
                label: '지출액',
                data: dailyData.map(d => d.total),
                backgroundColor: 'hsla(270, 75%, 62%, 0.6)',
                borderColor: 'hsl(270, 75%, 62%)',
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => formatMoney(v) } }
            }
        }
    });
}


// ══════════════════════════════════════════════
// PAGE: Add Restaurant (/manager/add)
// ══════════════════════════════════════════════
Router.register('/manager/add', (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>식당 추가</h1>
        </div>

        <div class="form-group">
            <label>식당명</label>
            <input type="text" class="input" id="rest-name" placeholder="예: 한솥도시락, 맛나식당" maxlength="100" autocomplete="off">
        </div>
        <div class="form-group">
            <label>초기 잔액 유형</label>
            <div class="meal-tags" id="initial-balance-type">
                <div class="meal-tag selected" data-type="charge">💰 충전 (양수)</div>
                <div class="meal-tag" data-type="spend">💸 외상 (음수)</div>
            </div>
        </div>
        <div class="form-group">
            <label>초기 설정 금액 (선택)</label>
            <input type="number" class="input input-amount" id="rest-balance" placeholder="0" min="0" inputmode="numeric">
            <div class="quick-amounts">
                <button class="quick-btn" data-amount="100000">+10만</button>
                <button class="quick-btn" data-amount="200000">+20만</button>
                <button class="quick-btn" data-amount="500000">+50만</button>
                <button class="quick-btn" data-amount="1000000">+100만</button>
            </div>
        </div>
        <div class="form-group">
            <label>메모 (연락처, 계약정보 등)</label>
            <input type="text" class="input" id="rest-memo" placeholder="선택사항" maxlength="255" autocomplete="off">
        </div>

        <button class="btn btn-primary btn-full btn-lg mt-20" id="btn-save">🏪 식당 등록하기</button>
    `;

    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/manager'));

    // Toggle balance type (Charge vs Spend)
    const typeTags = container.querySelectorAll('#initial-balance-type .meal-tag');
    typeTags.forEach(tag => {
        tag.addEventListener('click', () => {
            typeTags.forEach(t => t.classList.remove('selected'));
            tag.classList.add('selected');
        });
    });

    // Quick amount buttons
    container.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('rest-balance');
            const current = parseInt(input.value) || 0;
            input.value = current + parseInt(btn.dataset.amount);
        });
    });

    document.getElementById('btn-save').addEventListener('click', async () => {
        const name = document.getElementById('rest-name').value.trim();
        let balance = parseInt(document.getElementById('rest-balance').value) || 0;
        const memo = document.getElementById('rest-memo').value.trim();
        const balanceType = container.querySelector('#initial-balance-type .meal-tag.selected').dataset.type;

        if (!name) { Toast.error('식당명을 입력해주세요.'); return; }

        // 외상(음수)인 경우 마이너스 값으로 변환
        if (balanceType === 'spend') {
            balance = -Math.abs(balance);
        }

        try {
            await API.post(`/api/teams/${Session.getTeamId()}/restaurants`, {
                name, balance, memo,
                nickname: Session.getNickname(),
            });
            Toast.success('식당이 등록되었습니다!');
            Router.navigate('/manager/restaurants');
        } catch (e) {
            Toast.error(e.message);
        }
    });
});


// ══════════════════════════════════════════════
// PAGE: Restaurant List (/manager/restaurants)
// ══════════════════════════════════════════════
Router.register('/manager/restaurants', async (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>식당 목록</h1>
        </div>
        <div class="loading-screen"><div class="spinner"></div></div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/manager'));

    try {
        const res = await API.get(`/api/teams/${teamId}/restaurants`);
        const restaurants = res.data || [];

        if (restaurants.length === 0) {
            container.innerHTML = `
                <div class="page-header">
                    <button class="back-btn" id="back-btn">←</button>
                    <h1>식당 목록</h1>
                </div>
                <div class="empty-state">
                    <div class="empty-icon">🏪</div>
                    <p>등록된 식당이 없습니다</p>
                    <button class="btn btn-primary" id="btn-add">+ 식당 추가</button>
                </div>
            `;
            document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/manager'));
            document.getElementById('btn-add').addEventListener('click', () => Router.navigate('/manager/add'));
            return;
        }

        let html = `
            <div class="page-header" style="justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="back-btn" id="back-btn">←</button>
                    <h1>식당 목록 (${restaurants.length})</h1>
                </div>
                <button class="btn btn-sm btn-primary" id="btn-add" style="margin-left: auto;">+ 식당 추가</button>
            </div>
        `;

        for (const r of restaurants) {
            const isNeg = r.balance < 0;
            html += `
                <div class="restaurant-card">
                    <div class="rest-header">
                        <span class="rest-name">${escapeHtml(r.name)}</span>
                        <span class="rest-status ${r.status}">${r.status === 'active' ? '운영중' : '중지'}</span>
                    </div>
                    <div class="rest-balance ${isNeg ? 'negative' : 'positive'}">
                        ${isNeg ? '' : ''}${formatMoney(r.balance)}원
                    </div>
                    <div class="rest-meta">
                        <span>이번 달 사용: ${formatMoney(r.month_spend)}원</span>
                        <span>최근: ${r.last_used ? formatDate(r.last_used) : '-'}</span>
                    </div>
                    <div class="rest-actions">
                        <button class="btn btn-sm btn-success charge-btn" data-id="${r.id}">💰 충전</button>
                        <button class="btn btn-sm btn-ghost toggle-btn" data-id="${r.id}" data-status="${r.status}">
                            ${r.status === 'active' ? '⏸ 중지' : '▶ 재개'}
                        </button>
                        <button class="btn btn-sm btn-ghost delete-btn" data-id="${r.id}" data-name="${escapeHtml(r.name)}">🗑</button>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/manager'));
        document.getElementById('btn-add').addEventListener('click', () => Router.navigate('/manager/add'));

        // Charge buttons
        container.querySelectorAll('.charge-btn').forEach(btn => {
            btn.addEventListener('click', () => Router.navigate(`/manager/charge/${btn.dataset.id}`));
        });

        // Toggle status
        container.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStatus = btn.dataset.status === 'active' ? 'inactive' : 'active';
                try {
                    await API.put(`/api/teams/${teamId}/restaurants/${btn.dataset.id}`, { status: newStatus });
                    Toast.success(newStatus === 'active' ? '식당이 재개되었습니다.' : '식당이 일시중지되었습니다.');
                    Router.resolve(); // Refresh
                } catch (e) {
                    Toast.error(e.message);
                }
            });
        });

        // Delete buttons
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showModal(
                    '식당 삭제',
                    `<strong>'${btn.dataset.name}'</strong> 식당을 삭제하시겠습니까?<br><span style="color:var(--danger);font-size:0.85rem;">모든 거래 내역이 함께 삭제됩니다.</span>`,
                    '삭제',
                    '취소',
                    async () => {
                        try {
                            await API.delete(`/api/teams/${teamId}/restaurants/${btn.dataset.id}`);
                            Toast.success('식당이 삭제되었습니다.');
                            Router.resolve();
                        } catch (e) {
                            Toast.error(e.message);
                        }
                    }
                );
            });
        });

    } catch (e) {
        Toast.error(e.message);
    }
});


// ══════════════════════════════════════════════
// PAGE: Charge (/manager/charge/:restId)
// ══════════════════════════════════════════════
Router.register('/manager/charge/:restId', async (container, params) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();

    // Get restaurant info
    let restaurant;
    try {
        const res = await API.get(`/api/teams/${teamId}/restaurants`);
        restaurant = (res.data || []).find(r => r.id === params.restId);
        if (!restaurant) throw new Error('식당을 찾을 수 없습니다.');
    } catch (e) {
        Toast.error(e.message);
        Router.navigate('/manager/restaurants');
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>금액 충전</h1>
        </div>

        <div class="card mb-20">
            <div class="rest-name mb-8">${escapeHtml(restaurant.name)}</div>
            <div class="rest-balance ${restaurant.balance < 0 ? 'negative' : 'positive'}">
                현재 잔액: ${formatMoney(restaurant.balance)}원
            </div>
        </div>

        <div class="form-group">
            <label>충전 금액</label>
            <input type="number" class="input input-amount" id="charge-amount" placeholder="0" min="0">
            <div class="quick-amounts">
                <button class="quick-btn" data-amount="10000">+1만</button>
                <button class="quick-btn" data-amount="50000">+5만</button>
                <button class="quick-btn" data-amount="100000">+10만</button>
                <button class="quick-btn" data-amount="200000">+20만</button>
            </div>
        </div>
        <div class="form-group">
            <label>충전 사유 메모</label>
            <input type="text" class="input" id="charge-memo" placeholder="예: 6월분 선지급" maxlength="255" autocomplete="off">
        </div>

        <button class="btn btn-success btn-full btn-lg mt-20" id="btn-charge">💰 충전하기</button>
    `;

    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/manager/restaurants'));

    container.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('charge-amount');
            const current = parseInt(input.value) || 0;
            input.value = current + parseInt(btn.dataset.amount);
        });
    });

    document.getElementById('btn-charge').addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('charge-amount').value) || 0;
        const memo = document.getElementById('charge-memo').value.trim();

        if (amount <= 0) { Toast.error('충전 금액을 입력해주세요.'); return; }

        try {
            const res = await API.post(`/api/teams/${teamId}/restaurants/${params.restId}/charge`, {
                amount, memo,
                nickname: Session.getNickname(),
            });
            Toast.success(res.message);
            if (res.data && res.data.transaction_id) {
                Session.addMyTransaction(res.data.transaction_id);
            }
            Router.navigate('/manager/restaurants');
        } catch (e) {
            Toast.error(e.message);
        }
    });
});


// ══════════════════════════════════════════════
// PAGE: History (/manager/history)
// ══════════════════════════════════════════════
Router.register('/manager/history', async (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();

    // URL 쿼리 파라미터에서 restaurant_id 파싱
    const urlParams = new URLSearchParams(location.search);
    const filterRestId = urlParams.get('restaurant_id') || '';

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1 id="history-title">장부 내역</h1>
        </div>

        <div class="filter-bar" id="type-filter">
            <button class="filter-btn active" data-type="">전체</button>
            <button class="filter-btn" data-type="charge">충전</button>
            <button class="filter-btn" data-type="spend">차감</button>
        </div>

        <div class="form-group">
            <input type="text" class="input" id="search-nickname" placeholder="별명으로 검색..." autocomplete="off">
        </div>

        <ul class="tx-list" id="tx-list">
            <div class="loading-screen"><div class="spinner"></div></div>
        </ul>
    `;

    // 뒤로가기 흐름 동적 제어: 특정 식당에서 넘어왔으면 해당 식당 spend 페이지로 복귀
    document.getElementById('back-btn').addEventListener('click', () => {
        if (filterRestId) {
            Router.navigate(`/member/spend/${filterRestId}`);
        } else {
            Router.navigate('/manager');
        }
    });

    let currentType = '';

    async function loadHistory() {
        const nickname = document.getElementById('search-nickname').value.trim();
        const params = new URLSearchParams();
        if (currentType) params.set('type', currentType);
        if (nickname) params.set('nickname', nickname);
        if (filterRestId) params.set('restaurant_id', filterRestId);
        params.set('limit', '100');

        try {
            const res = await API.get(`/api/teams/${teamId}/transactions?${params}`);
            const txs = res.data || [];
            
            // 특정 식당 필터링 상태이고 데이터가 존재할 경우 제목에 식당명 반영
            if (filterRestId && txs.length > 0) {
                const restName = txs[0].restaurant_name;
                document.getElementById('history-title').textContent = `${restName} 장부`;
            } else if (filterRestId) {
                // 내역이 비어있을 때는 식당 명을 가져오기 위해 식당 API 조회
                try {
                    const restsRes = await API.get(`/api/teams/${teamId}/restaurants`);
                    const r = (restsRes.data || []).find(x => x.id === filterRestId);
                    if (r) {
                        document.getElementById('history-title').textContent = `${r.name} 장부`;
                    }
                } catch {}
            } else {
                document.getElementById('history-title').textContent = '통합 내역';
            }
            
            renderTransactionList(document.getElementById('tx-list'), txs);
        } catch (e) {
            Toast.error(e.message);
        }
    }

    // Filter buttons
    container.querySelectorAll('#type-filter .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('#type-filter .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
            loadHistory();
        });
    });

    // Search
    let searchTimeout;
    document.getElementById('search-nickname').addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadHistory, 400);
    });

    loadHistory();
});


// ══════════════════════════════════════════════
// PAGE: Member — Restaurant List (/member)
// ══════════════════════════════════════════════
Router.register('/member', async (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>식대 차감</h1>
        </div>
        <div class="loading-screen"><div class="spinner"></div></div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/home'));

    try {
        const res = await API.get(`/api/teams/${teamId}/restaurants`);
        const restaurants = (res.data || []).filter(r => r.status === 'active');

        if (restaurants.length === 0) {
            container.innerHTML = `
                <div class="page-header">
                    <button class="back-btn" id="back-btn">←</button>
                    <h1>식대 차감</h1>
                </div>
                <div class="empty-state">
                    <div class="empty-icon">🍽️</div>
                    <p>이용 가능한 식당이 없습니다</p>
                </div>
            `;
            document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/home'));
            return;
        }

        let html = `
            <div class="page-header">
                <button class="back-btn" id="back-btn">←</button>
                <h1>식당을 선택하세요</h1>
            </div>
        `;

        for (const r of restaurants) {
            const isNeg = r.balance < 0;
            html += `
                <div class="restaurant-card clickable" data-id="${r.id}">
                    <div class="rest-header">
                        <span class="rest-name">${escapeHtml(r.name)}</span>
                    </div>
                    <div class="rest-balance ${isNeg ? 'negative' : 'positive'}">
                        ${formatMoney(r.balance)}원
                    </div>
                </div>
            `;
        }

        html += `<button class="btn btn-ghost btn-full mt-20" id="btn-my-history">📜 내 사용 내역</button>`;
        container.innerHTML = html;

        document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/home'));
        document.getElementById('btn-my-history').addEventListener('click', () => Router.navigate('/member/history'));

        container.querySelectorAll('.restaurant-card.clickable').forEach(card => {
            card.addEventListener('click', () => Router.navigate(`/member/spend/${card.dataset.id}`));
        });

    } catch (e) {
        Toast.error(e.message);
    }
});


// ══════════════════════════════════════════════
// PAGE: Spend (/member/spend/:restId)
// ══════════════════════════════════════════════
Router.register('/member/spend/:restId', async (container, params) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();

    let restaurant;
    try {
        const res = await API.get(`/api/teams/${teamId}/restaurants`);
        restaurant = (res.data || []).find(r => r.id === params.restId);
        if (!restaurant) throw new Error('식당을 찾을 수 없습니다.');
    } catch (e) {
        Toast.error(e.message);
        Router.navigate('/member');
        return;
    }

    let selectedMemo = '';

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>${escapeHtml(restaurant.name)}</h1>
        </div>

        <div class="card mb-20">
            <div class="text-sm text-muted mb-8">현재 잔액</div>
            <div class="rest-balance ${restaurant.balance < 0 ? 'negative' : 'positive'}">
                ${formatMoney(restaurant.balance)}원
            </div>
        </div>

        <div class="form-group">
            <label>식사 금액</label>
            <input type="number" class="input input-amount" id="spend-amount" placeholder="0" min="0">
            <div class="quick-amounts">
                <button class="quick-btn" data-amount="-1000">-1,000</button>
                <button class="quick-btn" data-amount="-5000">-5,000</button>
                <button class="quick-btn" data-amount="5000">+5,000</button>
                <button class="quick-btn" data-amount="10000">+10,000</button>
            </div>
        </div>

        <div class="form-group">
            <label>용도</label>
            <div class="meal-tags">
                <button class="meal-tag" data-memo="점심">🌞 점심</button>
                <button class="meal-tag" data-memo="저녁">🌙 저녁</button>
                <button class="meal-tag" data-memo="야식/기타">🌃 야식/기타</button>
            </div>
        </div>

        <button class="btn btn-danger btn-full btn-lg mt-12" id="btn-spend">🍚 차감하기</button>

        <div class="mt-20" style="border-top: 1.5px solid var(--border); padding-top: 20px; margin-top: 28px;">
            <h3 style="font-size: 0.92rem; margin-bottom: 12px; color: var(--text-secondary); font-weight: 600;">📋 최근 장부 내역 (최근 3건)</h3>
            <ul class="tx-list" id="recent-spend-tx-list" style="margin-bottom: 0;">
                <div class="loading-screen" style="padding: 20px 0;"><div class="spinner"></div></div>
            </ul>
            <button class="btn btn-ghost btn-full mt-12" id="btn-view-history" style="font-size: 0.88rem; padding: 12px 16px;">🔍 이 식당 장부 전체보기</button>
        </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/member'));
    document.getElementById('btn-view-history').addEventListener('click', () => Router.navigate(`/manager/history?restaurant_id=${params.restId}`));

    // 최근 3건 내역 불러오기
    async function loadRecentHistory() {
        try {
            const res = await API.get(`/api/teams/${teamId}/transactions?restaurant_id=${params.restId}&limit=3`);
            const txs = res.data || [];
            const listContainer = document.getElementById('recent-spend-tx-list');
            
            if (txs.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 16px 0;">
                        최근 거래 내역이 없습니다.
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = txs.map(tx => `
                <li class="tx-item" style="padding: 10px 0; border-bottom: 1px solid var(--border);">
                    <div class="tx-icon ${tx.type}" style="width: 32px; height: 32px; font-size: 0.9rem; border-radius: var(--radius-sm);">
                        ${tx.type === 'charge' ? '💰' : '🍚'}
                    </div>
                    <div class="tx-body">
                        <div class="tx-title" style="font-size: 0.85rem;">${escapeHtml(tx.user_nickname)}</div>
                        <div class="tx-sub" style="font-size: 0.72rem; margin-top: 2px;">${formatDate(tx.created_at)}${tx.memo ? ' · ' + escapeHtml(tx.memo) : ''}</div>
                    </div>
                    <div>
                        <div class="tx-amount ${tx.type}" style="font-size: 0.9rem;">
                            ${tx.type === 'charge' ? '+' : '-'}${formatMoney(tx.amount)}
                        </div>
                    </div>
                </li>
            `).join('');
            
            // 마지막 아이템 보더 제거
            const items = listContainer.querySelectorAll('.tx-item');
            if (items.length > 0) {
                items[items.length - 1].style.borderBottom = 'none';
            }
        } catch (e) {
            console.error('최근 내역 로드 실패:', e);
            document.getElementById('recent-spend-tx-list').innerHTML = `
                <div style="text-align: center; color: var(--danger); font-size: 0.8rem; padding: 16px 0;">
                    내역 로드 실패: ${e.message}
                </div>
            `;
        }
    }

    loadRecentHistory();

    // Quick amount: 증감 (누적)
    container.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('spend-amount');
            const current = parseInt(input.value) || 0;
            const diff = parseInt(btn.dataset.amount) || 0;
            input.value = Math.max(0, current + diff);
        });
    });

    // Meal tag
    container.querySelectorAll('.meal-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            container.querySelectorAll('.meal-tag').forEach(t => t.classList.remove('selected'));
            tag.classList.add('selected');
            selectedMemo = tag.dataset.memo;
        });
    });

    document.getElementById('btn-spend').addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('spend-amount').value) || 0;
        if (amount <= 0) { Toast.error('차감 금액을 입력해주세요.'); return; }

        try {
            const res = await API.post(`/api/teams/${teamId}/restaurants/${params.restId}/spend`, {
                amount,
                memo: selectedMemo,
                nickname: Session.getNickname(),
            });
            Toast.success(res.message);
            if (res.data && res.data.transaction_id) {
                Session.addMyTransaction(res.data.transaction_id);
            }
            Router.navigate('/member/history');
        } catch (e) {
            Toast.error(e.message);
        }
    });
});


// ══════════════════════════════════════════════
// PAGE: My History (/member/history)
// ══════════════════════════════════════════════
Router.register('/member/history', async (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const teamId = Session.getTeamId();
    const nickname = Session.getNickname();

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>내 사용 내역</h1>
        </div>
        <p class="text-sm text-muted mb-16">${escapeHtml(nickname)}님의 식대 사용 기록</p>
        <ul class="tx-list" id="tx-list">
            <div class="loading-screen"><div class="spinner"></div></div>
        </ul>
    `;
    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/member'));

    try {
        const params = new URLSearchParams({ type: 'spend', nickname, limit: '100' });
        const res = await API.get(`/api/teams/${teamId}/transactions?${params}`);
        renderTransactionList(document.getElementById('tx-list'), res.data || []);
    } catch (e) {
        Toast.error(e.message);
    }
});


// ══════════════════════════════════════════════
// PAGE: Settings (/settings)
// ══════════════════════════════════════════════
Router.register('/settings', (container) => {
    if (!Session.isLoggedIn()) { Router.navigate('/', true); return; }
    const session = Session.get();

    container.innerHTML = `
        <div class="page-header">
            <button class="back-btn" id="back-btn">←</button>
            <h1>설정</h1>
        </div>

        <div class="card mb-20">
            <div class="text-sm text-muted mb-8">소속 팀</div>
            <div style="font-weight:700; font-size:1.1rem;">${escapeHtml(session.teamName)}</div>
        </div>

        <div class="form-group">
            <label>내 별명</label>
            <input type="text" class="input" id="settings-nickname" value="${escapeHtml(session.nickname)}" maxlength="50" autocomplete="off">
        </div>

        <button class="btn btn-primary btn-full mb-12" id="btn-save-nickname">별명 저장</button>

        <hr style="border:none; border-top:1px solid var(--border); margin:28px 0;">

        <button class="btn btn-danger btn-full" id="btn-leave">🚪 팀 탈퇴 (기기 정보 삭제)</button>
    `;

    document.getElementById('back-btn').addEventListener('click', () => Router.navigate('/home'));

    document.getElementById('btn-save-nickname').addEventListener('click', async () => {
        const newNick = document.getElementById('settings-nickname').value.trim();
        if (!newNick) { Toast.error('별명을 입력해주세요.'); return; }

        const oldNick = session.nickname;

        // 과거 내역도 함께 업데이트
        if (oldNick !== newNick) {
            try {
                await API.put(`/api/teams/${session.teamId}/nickname`, {
                    old_nickname: oldNick,
                    new_nickname: newNick,
                });
            } catch (e) {
                // 서버 오류 시에도 로컬은 변경
                console.warn('별명 내역 동기화 실패:', e.message);
            }
        }

        Session.set({ ...session, nickname: newNick });
        Toast.success('별명이 저장되었습니다.');
    });

    document.getElementById('btn-leave').addEventListener('click', () => {
        showModal(
            '팀 탈퇴',
            '이 기기에서 팀 연결을 해제하시겠습니까?<br><span style="color:var(--text-muted);font-size:0.85rem;">서버의 거래 기록은 유지되나, 이 기기에서 더 이상 접근할 수 없습니다.</span>',
            '탈퇴',
            '취소',
            () => {
                Session.clear();
                Toast.info('팀 연결이 해제되었습니다.');
                Router.navigate('/');
            }
        );
    });
});


// ──────────────────────────────────────────────
// Shared: Transaction List Renderer
// ──────────────────────────────────────────────
function renderTransactionList(container, transactions) {
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>거래 내역이 없습니다</p>
            </div>
        `;
        return;
    }

    const myTxs = Session.getMyTransactions();
    const now = new Date();

    container.innerHTML = transactions.map(tx => {
        const txTime = new Date(tx.created_at);
        const isEditable = myTxs.includes(tx.id) && (now - txTime < 3600000); // 1시간 이내

        return `
            <li class="tx-item" data-id="${tx.id}" data-amount="${tx.amount}" data-memo="${escapeHtml(tx.memo || '')}" data-name="${escapeHtml(tx.restaurant_name || '')}">
                <div class="tx-icon ${tx.type}">
                    ${tx.type === 'charge' ? '💰' : '🍚'}
                </div>
                <div class="tx-body">
                    <div class="tx-title">${escapeHtml(tx.restaurant_name || '')}</div>
                    <div class="tx-sub">${escapeHtml(tx.user_nickname)} · ${formatDate(tx.created_at)}${tx.memo ? ' · ' + escapeHtml(tx.memo) : ''}</div>
                </div>
                <div class="tx-right-side" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                    <div class="tx-amount ${tx.type}">
                        ${tx.type === 'charge' ? '+' : '-'}${formatMoney(tx.amount)}
                    </div>
                    <div class="tx-balance-after">잔액 ${formatMoney(tx.balance_after)}</div>
                    ${isEditable ? `
                        <div class="tx-actions" style="margin-top: 6px; display: flex; gap: 8px;">
                            <button class="btn-tx-action edit-tx-btn" title="수정" style="font-size: 0.72rem; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer;">✏️ 수정</button>
                            <button class="btn-tx-action delete-tx-btn" title="삭제" style="font-size: 0.72rem; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--danger); cursor: pointer;">🗑️ 삭제</button>
                        </div>
                    ` : ''}
                </div>
            </li>
        `;
    }).join('');

    // 삭제 버튼 리스너
    container.querySelectorAll('.delete-tx-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.tx-item');
            const txId = item.dataset.id;
            const restName = item.dataset.name;
            const amount = item.dataset.amount;
            
            showModal(
                '거래 내역 삭제',
                `<strong>'${escapeHtml(restName)}'</strong> 식당의 <strong>'${formatMoney(amount)}원'</strong> 거래 내역을 삭제하시겠습니까?<br><span style="color:var(--danger);font-size:0.85rem;">식당 잔액이 원래대로 복구됩니다.</span>`,
                '삭제',
                '취소',
                async () => {
                    try {
                        await API.delete(`/api/transactions/${txId}`);
                        Toast.success('거래가 삭제되었습니다.');
                        Router.resolve(); // 새로고침
                    } catch (err) {
                        Toast.error(err.message);
                    }
                }
            );
        });
    });

    // 수정 버튼 리스너
    container.querySelectorAll('.edit-tx-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.tx-item');
            const txId = item.dataset.id;
            const restName = item.dataset.name;
            const amount = item.dataset.amount;
            const memo = item.dataset.memo;
            
            showEditModal(
                `'${escapeHtml(restName)}' 거래 수정`,
                amount,
                memo,
                async (newAmount, newMemo) => {
                    try {
                        await API.put(`/api/transactions/${txId}`, { amount: newAmount, memo: newMemo });
                        Toast.success('거래 정보가 수정되었습니다.');
                        Router.resolve(); // 새로고침
                    } catch (err) {
                        Toast.error(err.message);
                    }
                }
            );
        });
    });
}


// ──────────────────────────────────────────────
// App Init
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    Toast.init();
    Router.init();
});
