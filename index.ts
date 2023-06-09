import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const project_name = 'infra-team'

const tags = { 
  Name: `${project_name}`
}

const vpc = new awsx.ec2.Vpc(`${project_name}-vpc`, {
  natGateways: {
    strategy: awsx.ec2.NatGatewayStrategy.OnePerAz,
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

const alb = new awsx.lb.ApplicationLoadBalancer(`${project_name}-lb`, {
  securityGroups: [group.id],
  subnetIds: vpc.publicSubnetIds,
  tags: tags
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
        value: `http://127.0.0.1:5000/WeatherForecast`
      }],
      portMappings: [
        {
          containerPort: 3000,
          hostPort: 3000
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

const service = new awsx.ecs.FargateService(`${project_name}-svc`, {
  cluster: cluster.arn,
  desiredCount: 2,
  taskDefinition: taskDefinition.taskDefinition.arn,
  networkConfiguration: {
    assignPublicIp: true,
    subnets: vpc.privateSubnetIds,
    securityGroups: [group.id],
  },
  loadBalancers: [{
    targetGroupArn: alb.defaultTargetGroup.arn,
    containerName: "infraweb",
    containerPort: 3000,
  }],
  tags: tags
});

export const url = pulumi.interpolate`http://${alb.loadBalancer.dnsName}`;