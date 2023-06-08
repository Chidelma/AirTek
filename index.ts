import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const project_name = 'infra-team'

const tags = { 
  Name: `${project_name}`
}

const vpc = new awsx.ec2.Vpc(`${project_name}-vpc`, {
  natGateways: {
    strategy: awsx.ec2.NatGatewayStrategy.Single,
  },
  tags: tags
});

const cluster = new aws.ecs.Cluster(`${project_name}-cluster`, {tags: tags});

const group = new aws.ec2.SecurityGroup(`${project_name}-sg`, {
  vpcId: vpc.vpcId,
  description: "Enable HTTP access",
  ingress: [{
    protocol: "tcp",
    fromPort: 80,
    toPort: 80,
    cidrBlocks: ["0.0.0.0/0"],
  }],
  egress: [{
    protocol: "-1",
    fromPort: 0,
    toPort: 0,
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: tags
});

const alb = new aws.lb.LoadBalancer(`${project_name}-lb`, {
  securityGroups: [group.id],
  subnets: vpc.publicSubnetIds,
  tags: tags
});

const targetGroup = new aws.lb.TargetGroup(`${project_name}-tg`, {
  port: 80,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.vpcId,
  tags: tags
});

const listener = new aws.lb.Listener(`${project_name}-web`, {
  loadBalancerArn: alb.arn,
  port: 80,
  defaultActions: [{
    type: "forward",
    targetGroupArn: targetGroup.arn,
  }],
  tags: tags
});

const role = new aws.iam.Role(`${project_name}-role`, {
  assumeRolePolicy: JSON.stringify({
    Version: "2008-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Principal: {
        Service: "ecs-tasks.amazonaws.com",
      },
      Effect: "Allow",
      Sid: "",
    }],
  }),
  tags: tags
});

new aws.iam.RolePolicyAttachment(`${project_name}-policy`, {
  role: role.name,
  policyArn: aws.iam.ManagedPolicy.AmazonECSTaskExecutionRolePolicy,
});

// Create a repository to store image for web
const repoWeb = new awsx.ecr.Repository(`${project_name}-web`, {
  tags: tags
})

// Create a repository to store image for api
const repoApi = new awsx.ecr.Repository(`${project_name}-api`, {
    tags: tags
})

// Build an image from Dockerfile stored in system and store in repo
const imageWeb = new awsx.ecr.Image(`${project_name}-web`, {
  repositoryUrl: repoWeb.url,
  path: './infra-web',
})

// Build an image from Dockerfile stored in system and store in repo
const imageApi = new awsx.ecr.Image(`${project_name}-api`, {
    repositoryUrl: repoApi.url,
    path: './infra-api'
})

const taskDefinition = new awsx.ecs.FargateTaskDefinition(`${project_name}-td`, {
  tags: tags,
  containers: {
    infraweb: {
      image: imageWeb.imageUri,
      memory: 1024,
      cpu: 2048,
      essential: true,
      environment: [{
        name: 'ApiAddress',
        value: `http://i127.0.0.1:5000/WeatherForecast`
      }],
      portMappings: [
        {
          containerPort: 80,
          hostPort: 80
        }
      ],
    },
    infraapi: {
      image: imageApi.imageUri,
      memory: 1024,
      cpu: 2048,
      essential: true,
      portMappings: [
        {
          containerPort: 5000,
          hostPort: 5000
        }
      ],
    }
  }
});

const service = new aws.ecs.Service(`${project_name}-svc`, {
  cluster: cluster.arn,
  desiredCount: 1,
  launchType: "FARGATE",
  taskDefinition: taskDefinition.taskDefinition.arn,
  networkConfiguration: {
    assignPublicIp: true,
    subnets: vpc.privateSubnetIds,
    securityGroups: [group.id],
  },
  loadBalancers: [{
    targetGroupArn: targetGroup.arn,
    containerName: "infraweb",
    containerPort: 80,
  }],
  tags: tags
});

export const url = pulumi.interpolate`http://${alb.dnsName}`;