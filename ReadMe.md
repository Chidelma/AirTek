# Pulumi Infrastructure Deployment

## Requirements

### Local Requirements
- Pulumi CLI 
- Node.js
- AWS CLI 

### Cloud Requirements
- AWS account credentials
- Access to the AWS resources (VPC, EC2, ECS, IAM, etc.)

## AWS Permissions

Make sure the AWS IAM user or role used for deployment has the following permissions:
- AWSManagedPolicyAmazonECS_FullAccess
- AWSManagedPolicyAmazonEC2_FullAccess
- AWSManagedPolicyAmazonECSTaskExecutionRolePolicy
- AWSManagedPolicyAmazonVPCFullAccess
- AWSManagedPolicyElasticLoadBalancingFullAccess

## Instructions

### 1. Clone the repository

bash`git clone https://github.com/your-username/your-repository.git`

### 2. Install dependencies

bash`cd <folder> && npm i`

### 3. Configure AWS credentials

Make sure your AWS credentials are properly configured. You can set them using the AWS CLI or by setting the environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### 4. Set up the Pulumi stack

bash`pulumi stack init`

### 5. Configure the Pulumi stack

bash`pulumi config set aws:region <your-aws-region>`

### 6. Deploy the infrastructure

bash`pulumi up`

### 7. Access the application

After the deployment is complete, you can access the application using the provider Pulumni output: `http://<load-balancer-dns-name>`

### 8. Clean up

To delete the deployed infrastructure and resources, run:

bash`pulumi destroy`

Note: This will destroy all resources created by the Pulumi stack.

