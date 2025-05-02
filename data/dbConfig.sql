-- SQL script to create the database schema for the document management system

-- Create the database
CREATE DATABASE IF NOT EXISTS document_management;
USE document_management;

-- Create the Documents table
CREATE TABLE IF NOT EXISTS Documents (
    id CHAR(36) NOT NULL PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    properties JSON NOT NULL,
    contentFile VARCHAR(255),
    associations JSON,
    entitlement JSON,
    version INT DEFAULT 1,
    createdBy VARCHAR(255) NOT NULL,
    organizationId VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create the Attachments table
CREATE TABLE IF NOT EXISTS Attachments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    documentId CHAR(36) NOT NULL,
    type VARCHAR(255) NOT NULL,
    contentFile VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (documentId) REFERENCES Documents(id) ON DELETE CASCADE
);

-- Create the Transactions table
CREATE TABLE IF NOT EXISTS Transactions (
    correlationId CHAR(36) NOT NULL PRIMARY KEY,
    status VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);