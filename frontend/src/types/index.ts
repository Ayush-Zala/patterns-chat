export interface ApiHealthResponse {
  status: string;
  message: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  iconName: string;
  tag: string;
}
