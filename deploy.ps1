# ==========================================
# e-식당 장부 (e-Meal Book) 배포 스크립트 (Windows PowerShell용)
# ==========================================

# 1. 설정 변수
$VM_IP = "64.110.111.151"
$VM_USER = "ubuntu"
$SSH_KEY = ".\ssh-key-2026-06-11.key"
$REMOTE_DIR = "/home/$VM_USER/meal-book"

Write-Host "[1/3] 원격 서버($VM_IP)에 접속하여 최신 소스 코드 반영 중..." -ForegroundColor Green

# 원격 서버에서 프로젝트 폴더가 없으면 생성하고 git clone을 시도하거나,
# 폴더가 있으면 git pull을 실행합니다.
ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" "
    if [ ! -d '$REMOTE_DIR' ]; then
        echo '원격 디렉토리가 존재하지 않습니다. 새로 생성하고 저장소를 클론합니다.';
        git clone https://github.com/capking1/meal-book.git '$REMOTE_DIR';
    fi
    cd '$REMOTE_DIR' && git pull origin main
"

if ($LASTEXITCODE -ne 0) {
    Write-Host "오류: 원격 서버에서 최신 소스 코드를 반영하지 못했습니다. SSH 연결이나 Git 권한을 확인해 주세요." -ForegroundColor Red
    exit
}

Write-Host "[2/3] 로컬 환경 설정 파일(.env) 동기화 중..." -ForegroundColor Green
if (Test-Path ".env") {
    scp -i $SSH_KEY -o StrictHostKeyChecking=no .env "${VM_USER}@${VM_IP}:${REMOTE_DIR}/.env"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "환경 설정 파일(.env)이 원격 서버에 복사되었습니다."
    } else {
        Write-Host "경고: .env 파일 복사에 실패했습니다." -ForegroundColor Yellow
    }
} else {
    Write-Host "로컬에 .env 파일이 존재하지 않아 복사를 건너뜁니다."
}

Write-Host "[3/3] 원격 서버에서 Docker Compose 빌드 및 실행 중..." -ForegroundColor Green
ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" "
    cd '$REMOTE_DIR'
    echo '기존 충돌 가능성이 있는 컨테이너(meal-db, meal-app) 제거 중...'
    docker rm -f meal-db meal-app 2>/dev/null || true
    
    if command -v docker-compose &> /dev/null; then
        echo 'Using legacy docker-compose...';
        docker-compose down;
        docker-compose up --build -d;
    else
        echo 'Using docker compose (v2)...';
        docker compose down;
        docker compose up --build -d;
    fi
"

if ($LASTEXITCODE -eq 0) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "배포가 성공적으로 완료되었습니다!" -ForegroundColor Green
    Write-Host "접속 주소: http://$VM_IP:7890" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "오류: Docker Compose 빌드 및 실행에 실패했습니다." -ForegroundColor Red
}
