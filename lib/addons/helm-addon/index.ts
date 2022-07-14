import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as spi from "../..";
import * as utils from "../../utils";
import { HelmChartConfiguration, KubectlProvider } from "./kubectl-provider";

export type HelmAddOnProps = HelmChartConfiguration;
export type HelmAddOnUserProps = Partial<HelmChartConfiguration>;

export class HelmAddonPropsConstraints implements utils.ConstraintsType<HelmAddOnProps> {
    /**
    * chart can be no less than 1 character long, and no greater than 63 characters long due to DNS system limitations.
    * https://helm.sh/docs/chart_template_guide/getting_started/#:~:text=TIP%3A%20The%20name%3A%20field%20is,are%20limited%20to%2053%20characters
    */
    chart = new utils.StringConstraint(1, 63);

    /**
    * name can be no less than 1 character long, and no greater than 63 characters long due to DNS system limitations.
    * https://helm.sh/docs/chart_template_guide/getting_started/#:~:text=TIP%3A%20The%20name%3A%20field%20is,are%20limited%20to%2053%20characters
    */
    name = new utils.StringConstraint(1, 63);

    /**
    * namespace can be no less than 1 character long, and no greater than 63 characters long due to DNS system limitations.
    * https://helm.sh/docs/chart_template_guide/getting_started/#:~:text=TIP%3A%20The%20name%3A%20field%20is,are%20limited%20to%2053%20characters
    */
    namespace = new utils.StringConstraint(1, 63);

    /**
    * release can be no less than 1 character long, and no greater than 53 characters long.
    * https://helm.sh/docs/chart_template_guide/getting_started/#:~:text=TIP%3A%20The%20name%3A%20field%20is,are%20limited%20to%2053%20characters
    */
    release = new utils.StringConstraint(1, 53);

    /**
    * repository can be no less than 0 characters long, and no greater than 4096 characters long. It also must follow a URL format.
    * https://docs.aws.amazon.com/connect/latest/APIReference/API_UrlReference.html
    */
    repository = new utils.UrlStringConstraint(0, 4096);

    /**
    * version can be no less than 1 character long, and no greater than 63 characters long due to DNS system limitations.
    * https://helm.sh/docs/chart_template_guide/getting_started/#:~:text=TIP%3A%20The%20name%3A%20field%20is,are%20limited%20to%2053%20characters
    */
    version = new utils.StringConstraint(1, 63);
}

export abstract class HelmAddOn implements spi.ClusterAddOn {

    props: HelmAddOnProps;

    constructor(props: HelmAddOnProps) {
        this.props = utils.cloneDeep(props); // avoids pollution when reusing the same props across stacks, such as values

        utils.validateConstraints(new HelmAddonPropsConstraints, HelmAddOn.name, props);
    }

    abstract deploy(clusterInfo: spi.ClusterInfo): void | Promise<Construct>;

    protected addHelmChart(clusterInfo: spi.ClusterInfo, values?: spi.Values, createNamespace?: boolean, wait?: boolean, timeout?: Duration): Construct {
        const kubectlProvider = new KubectlProvider(clusterInfo);
        values = values ?? {};
        const chart = { ...this.props, ...{ values, wait, timeout, createNamespace } };
        return kubectlProvider.addHelmChart(chart);
    }
}