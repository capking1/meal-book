#!/bin/bash

# ==========================================
# e-식당 장부 (e-Meal Book) 배포 스크립트
# ==========================================

# 1. 설정 변수
# ------------------------------------------
# 원격 VM IP 주소 (Oracle Cloud Instance Public IP)
VM_IP="64.110.111.151"

# 원격 VM 사용자 (Ubuntu OS이므로 ubuntu 사용)
VM_USER="ubuntu"

# SSH 개인키 파일 경로 (기존 키 파일 활용)
SSH_KEY="./ssh-key-2026-06-11.key"

# 원격 서버의 프로젝트 디렉토리 경로
REMOTE_DIR="/home/${VM_USER}/meal-book"

# ------------------------------------------

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}[1/4] SSH 키 파일 권한 설정 중...${NC}"
# SSH 키 파일 권한 수정 (읽기 권한만 부여 - 리눅스/Cloud Shell 환경 대비)
if [ -f "$SSH_KEY" ]; then
    chmod 600 "$SSH_KEY"
else
    echo -e "${YELLOW}경고: SSH 키 파일을 찾을 수 없습니다. ($SSH_KEY)${NC}"
    echo -e "${YELLOW}Cloud Shell 세션에 키 파일을 업로드했는지 확인해주세요.${NC}"
fi

echo -e "${GREEN}[2/4] 원격 서버($VM_IP)에 접속하여 최신 소스 코드 반영 중...${NC}"
# 원격 서버에서 프로젝트 폴더가 없으면 생성하고 git clone을 시도하거나,
# 폴더가 있으면 git pull을 실행합니다.
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" "
    if [ ! -d '$REMOTE_DIR' ]; then
        echo '원격 디렉토리가 존재하지 않습니다. 새로 생성하고 저장소를 클론합니다.';
        git clone https://github.com/capking1/meal-book.git '$REMOTE_DIR';
    fi
    cd '$REMOTE_DIR' && git fetch --all && git reset --hard origin/main
"

if [ $? -ne 0 ]; then
    echo -e "${RED}오류: 원격 서버에서 최신 소스 코드를 반영하지 못했습니다. SSH 연결이나 Git 권한을 확인해 주세요.${NC}"
    exit 1
fi

echo -e "${GREEN}[3/4] 로컬 환경 설정 파일(.env) 동기화 중...${NC}"
# 로컬에 .env가 있다면 원격에 전송합니다.
if [ -f ".env" ]; then
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no .env "${VM_USER}@${VM_IP}:${REMOTE_DIR}/.env"
    if [ $? -eq 0 ]; then
        echo "환경 설정 파일(.env)이 원격 서버에 복사되었습니다."
    else
        echo -e "${YELLOW}경고: .env 파일 복사에 실패했습니다.${NC}"
    fi
else
    echo "로컬에 .env 파일이 존재하지 않아 복사를 건너뜁니다."
fi

echo -e "${GREEN}[4/4] 원격 서버에서 Docker Compose 빌드 및 실행 중...${NC}"
# 원격 서버에서 기존 충돌 가능성이 있는 컨테이너를 강제 제거 후 docker-compose를 실행합니다.
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" "
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

if [ $? -eq 0 ]; then
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}배포가 성공적으로 완료되었습니다!${NC}"
    echo -e "${GREEN}접속 주소: http://$VM_IP${NC}"
    echo -e "${GREEN}==========================================${NC}"
else
    echo -e "${RED}오류: Docker Compose 빌드 및 실행에 실패했습니다.${NC}"
    exit 1
fi
