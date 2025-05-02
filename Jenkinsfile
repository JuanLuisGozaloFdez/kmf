pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "document-management-system"
        DOCKER_REGISTRY = "your-docker-registry"
        ENV = "preprod" // Change to "prod" for production deployment
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh 'docker build -t $DOCKER_IMAGE .'
            }
        }

        stage('Test') {
            steps {
                sh 'npm install'
                sh 'npm test'
            }
        }

        stage('Push to Registry') {
            steps {
                withDockerRegistry([credentialsId: 'docker-credentials', url: "https://$DOCKER_REGISTRY"]) {
                    sh 'docker tag $DOCKER_IMAGE $DOCKER_REGISTRY/$DOCKER_IMAGE'
                    sh 'docker push $DOCKER_REGISTRY/$DOCKER_IMAGE'
                }
            }
        }

        stage('Deploy to Pre-production') {
            when {
                environment name: 'ENV', value: 'preprod'
            }
            steps {
                sh 'docker-compose --env-file .env.preprod down'
                sh 'docker-compose --env-file .env.preprod up -d'
            }
        }

        stage('Deploy to Production') {
            when {
                environment name: 'ENV', value: 'prod'
            }
            steps {
                sh 'docker-compose --env-file .env.prod down'
                sh 'docker-compose --env-file .env.prod up -d'
            }
        }
    }
}