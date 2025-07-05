#!/bin/bash

# Load environment variables if .env file exists in the current directory or parent
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
elif [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-password}" # Be cautious with passwords in scripts
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-ai_call_center}" # This is the DB name defined in schema.sql
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "ERROR: Schema file not found at $SCHEMA_FILE"
    exit 1
fi

echo "Attempting to install database schema from $SCHEMA_FILE"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST"

# Construct the mysql command.
# We first connect without specifying a database to create it,
# then we connect to the specific database to create tables.
# The schema.sql itself handles "CREATE DATABASE IF NOT EXISTS" and "USE DB_NAME".

# Check if mysql client is installed
if ! command -v mysql &> /dev/null
then
    echo "MySQL client (mysql) could not be found. Please install it."
    exit 1
fi

# Execute the schema.sql script
# The script itself contains 'CREATE DATABASE IF NOT EXISTS' and 'USE database_name'
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
  echo "Database schema installed successfully."
else
  echo "ERROR: Database schema installation failed."
  echo "Please check MySQL credentials and ensure the MySQL server is running."
  exit 1
fi

echo "Done."
