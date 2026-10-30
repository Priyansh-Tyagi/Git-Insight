/**
 * Maps declared dependencies (from manifest files) to the skills used by Job match.
 *
 * Honesty notes:
 *  - A declared dependency shows a project USES a library, not how well the author knows it. The UI says so.
 *  - Only DIRECT dependencies from manifests are seen; transitive ones and lockfiles are ignored on purpose.
 *  - "Node.js" is inferred only from server-side frameworks (express, koa, nest...), because every front-end
 *    project has a package.json and that alone proves nothing about Node.
 */

export type Ecosystem = 'npm' | 'python' | 'maven' | 'composer' | 'ruby' | 'go' | 'nuget';

interface Rule {
  skills: string[];
  exact: string[];
  prefix: string[];
}

const rule = (skills: string | string[], exact: string[] = [], prefix: string[] = []): Rule => ({
  skills: Array.isArray(skills) ? skills : [skills],
  exact,
  prefix,
});

export const RULES: Record<Ecosystem, Rule[]> = {
  npm: [
    rule('React', ['react', 'react-dom']),
    rule('Next.js', ['next']),
    rule('Vue', ['vue', 'nuxt', 'nuxt3']),
    rule('Angular', ['@angular/core']),
    rule('Tailwind CSS', ['tailwindcss']),
    rule('Express', ['express']),
    rule('Node.js', ['express', 'koa', 'fastify', 'hapi', '@hapi/hapi', 'restify', '@nestjs/core', 'socket.io', 'apollo-server', '@apollo/server']),
    rule('GraphQL', ['graphql', 'graphql-yoga', 'type-graphql', 'apollo-server'], ['@apollo/']),
    rule('SQL', ['pg', 'mysql', 'mysql2', 'sqlite3', 'better-sqlite3', 'sequelize', 'typeorm', 'knex', '@prisma/client', 'drizzle-orm', 'mssql', 'oracledb']),
    rule('MongoDB', ['mongoose', 'mongodb', 'mongoist', '@typegoose/typegoose']),
    rule('Redis', ['redis', 'ioredis', '@redis/client']),
    rule('AWS', ['aws-sdk', 'aws-cdk-lib', 'aws-cdk'], ['@aws-sdk/', '@aws-cdk/']),
    rule('Azure', [], ['@azure/']),
    rule('Google Cloud', [], ['@google-cloud/']),
    rule(['TensorFlow', 'Machine Learning'], [], ['@tensorflow/']),
    rule('Machine Learning', ['brain.js', 'ml5', 'onnxruntime-node', '@xenova/transformers']),
    rule('Testing', ['jest', 'vitest', 'mocha', 'jasmine', 'ava', 'cypress', 'playwright', '@playwright/test', 'supertest', 'karma'], ['@testing-library/']),
  ],
  python: [
    rule('Django', ['django']),
    rule('REST APIs', ['djangorestframework', 'flask-restful', 'flask-restx', 'flask-restplus']),
    rule('Flask', ['flask']),
    rule('FastAPI', ['fastapi']),
    rule(['TensorFlow', 'Machine Learning'], ['tensorflow', 'tensorflow-cpu', 'tensorflow-gpu', 'tf-keras']),
    rule(['PyTorch', 'Machine Learning'], ['torch', 'pytorch-lightning', 'torchvision', 'torchaudio']),
    rule('Machine Learning', ['scikit-learn', 'sklearn', 'xgboost', 'lightgbm', 'catboost', 'keras', 'transformers']),
    rule('SQL', ['sqlalchemy', 'psycopg2', 'psycopg2-binary', 'psycopg', 'pymysql', 'mysqlclient', 'mysql-connector-python', 'peewee', 'sqlmodel', 'asyncpg', 'pyodbc']),
    rule('MongoDB', ['pymongo', 'motor', 'mongoengine', 'beanie']),
    rule('Redis', ['redis', 'aioredis', 'redis-py']),
    rule('GraphQL', ['graphene', 'strawberry-graphql', 'ariadne', 'graphql-core']),
    rule('AWS', ['boto3', 'botocore', 'aws-cdk-lib', 'aws-lambda-powertools']),
    rule('Azure', [], ['azure-']),
    rule('Google Cloud', [], ['google-cloud-']),
    rule('Testing', ['pytest', 'nose', 'nose2', 'hypothesis', 'tox', 'robotframework', 'behave'], ['pytest-']),
  ],
  maven: [
    rule('Spring', [], ['org.springframework']),
    rule('SQL', ['org.postgresql:postgresql', 'mysql:mysql-connector-java', 'com.mysql:mysql-connector-j', 'org.hibernate:hibernate-core', 'com.h2database:h2', 'org.xerial:sqlite-jdbc', 'org.mariadb.jdbc:mariadb-java-client', 'org.springframework.boot:spring-boot-starter-data-jpa', 'org.springframework.boot:spring-boot-starter-jdbc']),
    rule('MongoDB', ['org.mongodb:mongodb-driver-sync', 'org.mongodb:mongodb-driver-reactivestreams', 'org.mongodb:mongo-java-driver', 'org.springframework.boot:spring-boot-starter-data-mongodb']),
    rule('Redis', ['redis.clients:jedis', 'io.lettuce:lettuce-core', 'org.springframework.boot:spring-boot-starter-data-redis']),
    rule('GraphQL', [], ['com.graphql-java']),
    rule('AWS', [], ['software.amazon.awssdk', 'com.amazonaws:aws-java-sdk']),
    rule('Azure', [], ['com.azure']),
    rule('Google Cloud', [], ['com.google.cloud']),
    rule('Testing', ['junit:junit', 'org.testng:testng', 'org.springframework.boot:spring-boot-starter-test'], ['org.junit', 'org.mockito']),
  ],
  composer: [
    rule('Laravel', ['laravel/framework']),
    rule('Testing', ['phpunit/phpunit', 'pestphp/pest']),
    rule('SQL', ['doctrine/dbal', 'doctrine/orm', 'illuminate/database']),
    rule('MongoDB', ['mongodb/mongodb']),
    rule('Redis', ['predis/predis']),
    rule('AWS', ['aws/aws-sdk-php']),
    rule('GraphQL', ['webonyx/graphql-php', 'nuwave/lighthouse']),
  ],
  ruby: [
    rule('Rails', ['rails']),
    rule('Testing', ['rspec', 'rspec-rails', 'minitest', 'capybara', 'cucumber']),
    rule('SQL', ['pg', 'mysql2', 'sqlite3', 'sequel']),
    rule('MongoDB', ['mongoid', 'mongo']),
    rule('Redis', ['redis']),
    rule('GraphQL', ['graphql']),
    rule('AWS', [], ['aws-sdk']),
  ],
  go: [
    rule('SQL', [], ['github.com/lib/pq', 'github.com/go-sql-driver/mysql', 'gorm.io/gorm', 'github.com/jackc/pgx', 'github.com/jmoiron/sqlx', 'github.com/mattn/go-sqlite3']),
    rule('MongoDB', [], ['go.mongodb.org/mongo-driver']),
    rule('Redis', [], ['github.com/go-redis/redis', 'github.com/redis/go-redis']),
    rule('GraphQL', [], ['github.com/99designs/gqlgen', 'github.com/graphql-go/graphql']),
    rule('AWS', [], ['github.com/aws/aws-sdk-go']),
    rule('Google Cloud', [], ['cloud.google.com/go']),
    rule('Testing', [], ['github.com/stretchr/testify']),
  ],
  nuget: [
    rule('.NET', ['microsoft.net.sdk.web'], ['microsoft.aspnetcore']),
    rule('SQL', ['npgsql', 'dapper', 'microsoft.data.sqlclient', 'system.data.sqlclient', 'mysql.data'], ['microsoft.entityframeworkcore', 'pomelo.entityframeworkcore']),
    rule('MongoDB', [], ['mongodb.driver']),
    rule('Redis', ['stackexchange.redis']),
    rule('Testing', ['xunit', 'nunit', 'mstest.testframework', 'microsoft.net.test.sdk']),
    rule('AWS', [], ['awssdk.']),
    rule('Azure', [], ['azure.']),
  ],
};

/** Skills that are detected from file names rather than dependency declarations. */
export const FILE_BASED_SKILLS = ['Terraform'];

/** Every skill this module can verify — Job match treats these as "checkable once repos are scanned". */
export const DEPENDENCY_SKILLS: ReadonlySet<string> = new Set([
  ...Object.values(RULES).flatMap((rules) => rules.flatMap((r) => r.skills)),
  ...FILE_BASED_SKILLS,
]);

/** Brings a raw dependency name to the form the rule tables use. */
export function normalizeDependencyName(ecosystem: Ecosystem, raw: string): string {
  const name = raw.trim().toLowerCase();
  return ecosystem === 'python' ? name.replace(/[-_.]+/g, '-') : name;
}

export function skillsForDependency(ecosystem: Ecosystem, rawName: string): string[] {
  const name = normalizeDependencyName(ecosystem, rawName);
  if (!name) return [];
  const out = new Set<string>();
  for (const r of RULES[ecosystem]) {
    if (r.exact.includes(name) || r.prefix.some((p) => name.startsWith(p))) r.skills.forEach((s) => out.add(s));
  }
  return [...out];
}
