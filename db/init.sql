-- e-식당 장부 초기 스키마
-- docker-entrypoint-initdb.d 에 마운트되어 최초 실행 시 자동 적용

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
    team_id VARCHAR(36) NOT NULL,
    restaurant_id VARCHAR(36) NOT NULL,
    type VARCHAR(10) NOT NULL,       -- 'charge' / 'spend'
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    user_nickname VARCHAR(50) NOT NULL,
    memo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES MealTeams(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES MealRestaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
