-- Create MindGuardianSQL database and users_sql table
CREATE DATABASE IF NOT EXISTS MindGuardianSQL
  DEFAULT CHARACTER SET = 'utf8mb4'
  DEFAULT COLLATE = 'utf8mb4_unicode_ci';

USE MindGuardianSQL;

CREATE TABLE IF NOT EXISTS users_sql (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userName VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  passWord VARCHAR(255),
  role VARCHAR(50),
  resetToken VARCHAR(255),
  resetTokenExpiry BIGINT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
