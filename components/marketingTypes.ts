// Types for Marketing Center

export interface MarketingCampaign {
  id_campaign: string;
  id_tenant: string;
  name: string;
  subject: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  html_content?: string;
  text_content?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'ARCHIVED';
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
  updated_at?: string;
  created_by: string;
  stats?: {
    sent: number;
    opened: number;
    clicked: number;
    bounced?: number;
    unsubscribed?: number;
  };
  selectedLists?: string[];
}

export interface MarketingList {
  id_list: string;
  id_tenant: string;
  name: string;
  description?: string;
  type: 'STATIC' | 'DYNAMIC';
  visibility: 'PRIVATE' | 'PUBLIC' | 'SHARED';
  member_count: number;
  created_at: string;
  created_by?: string;
  filter_criteria?: any;
}

export interface MarketingListMember {
  id_member: string;
  id_list: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';
  added_at: string;
  source?: string;
}

export interface MarketingIntegration {
  id_integration: string;
  id_tenant: string;
  provider: 'GOOGLE' | 'MICROSOFT' | 'SENDGRID' | 'MAILCHIMP' | 'OTHER';
  email_connected?: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  connected_at?: string;
  credentials?: any;
}

export interface SharedUser {
  id_user: string;
  name: string;
  email: string;
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
}

export interface CurrentUser {
  id_user: string;
  id_tenant: string;
  name: string;
  email: string;
}
