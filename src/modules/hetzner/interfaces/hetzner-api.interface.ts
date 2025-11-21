export interface HetznerServer {
  id: number;
  name: string;
  status: 'running' | 'off' | 'starting' | 'stopping' | 'rebooting';
  public_net: {
    ipv4: {
      ip: string;
      blocked: boolean;
    };
    ipv6: {
      ip: string;
      blocked: boolean;
    };
  };
  server_type: {
    id: number;
    name: string;
    description: string;
    cores: number;
    memory: number;
    disk: number;
  };
  datacenter: {
    id: number;
    name: string;
    description: string;
    location: {
      id: number;
      name: string;
      city: string;
      country: string;
      latitude: number;
      longitude: number;
    };
  };
  image: {
    id: number;
    name: string;
    description: string;
    type: string;
  } | null;
  created: string;
}

export interface HetznerServersResponse {
  servers: HetznerServer[];
  meta?: {
    pagination: {
      page: number;
      per_page: number;
      previous_page: number | null;
      next_page: number | null;
      last_page: number;
      total_entries: number;
    };
  };
}

export interface HetznerServerResponse {
  server: HetznerServer;
}

export interface HetznerActionResponse {
  action: {
    id: number;
    command: string;
    status: 'running' | 'success' | 'error';
    progress: number;
    started: string;
    finished: string | null;
    error: {
      code: string;
      message: string;
    } | null;
  };
}

export interface HetznerErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
