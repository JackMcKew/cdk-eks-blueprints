import { Construct } from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as eks from "@aws-cdk/aws-eks";


// Cluster
import { ClusterInfo, ClusterProvider } from "..";

// Utils 
import { valueFromContext } from '../utils/context-utils';

// Constants
import * as constants from './constants';
import { SelfManagedNodeGroup } from "./types";
import { UpdatePolicy } from "@aws-cdk/aws-autoscaling";

/**
 * Configuration options for the cluster provider.
 */
export interface AsgClusterProviderProps extends eks.CommonClusterOptions, SelfManagedNodeGroup {
    /**
     * The name for the cluster.
     */
    name?: string

    /**
     * Is it a private only EKS Cluster?
     * Defaults to private_and_public cluster, set to true for private cluster
     * @default false
     */
    privateCluster?: boolean;

    /**
     * Affects both control plane and the managed node group.
    */
    vpcSubnets?: ec2.SubnetSelection[];
}

/**
 * AsgClusterProvider provisions an EKS cluster with an autoscaling group for self-managed capacity.
 */
export class AsgClusterProvider implements ClusterProvider {

    readonly props: AsgClusterProviderProps;

    constructor(props?: AsgClusterProviderProps) {
        this.props = props ?? { version: eks.KubernetesVersion.V1_20 };
    }

    createCluster(scope: Construct, vpc: ec2.IVpc): ClusterInfo {
        const id = scope.node.id;

        // Cluster options.
        const clusterName = this.props.name ?? id;
        const outputClusterName = true;
        const version = this.props.version;
        const privateCluster = this.props.privateCluster ?? valueFromContext(scope, constants.PRIVATE_CLUSTER, false);
        const vpcSubnets = (privateCluster === true) ? [{ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }] : this.props.vpcSubnets;
        const endpointAccess = (privateCluster === true) ? eks.EndpointAccess.PRIVATE : eks.EndpointAccess.PUBLIC_AND_PRIVATE;

        const cluster = new eks.Cluster(scope, scope.node.id, {
            vpc,
            clusterName,
            outputClusterName,
            version,
            vpcSubnets,
            endpointAccess,
            defaultCapacity: 0, // we want to manage capacity ourselves
        });

        // Props for the auto scaling group.
        const machineImageType = this.props.machineImageType ?? eks.MachineImageType.AMAZON_LINUX_2;
        const instanceType = this.props.instanceType ?? valueFromContext(scope, constants.INSTANCE_TYPE_KEY, constants.DEFAULT_INSTANCE_TYPE);
        const minSize = this.props.minSize ?? valueFromContext(scope, constants.MIN_SIZE_KEY, constants.DEFAULT_NG_MINSIZE);
        const maxSize = this.props.maxSize ?? valueFromContext(scope, constants.MAX_SIZE_KEY, constants.DEFAULT_NG_MAXSIZE);
        const desiredSize = this.props.desiredSize ?? valueFromContext(scope, constants.DESIRED_SIZE_KEY, minSize);
        const updatePolicy = UpdatePolicy.rollingUpdate();

        // Create an autoscaling group
        const asg = cluster.addAutoScalingGroupCapacity('SelfManagedNodes', {
            machineImageType,
            instanceType,
            minCapacity: minSize,
            maxCapacity: maxSize,
            desiredCapacity: desiredSize,
            updatePolicy,
        });
        return new ClusterInfo(cluster, version, asg);
    }
}
