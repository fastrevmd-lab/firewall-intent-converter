/**
 * Sample Configurations for Testing
 *
 * PAN-OS samples:
 *   1. Basic — Small office: 2 zones, 5 address objects, 6 security rules, 1 NAT
 *   2. Medium — Branch office: 3 zones, address groups, service objects, 12 rules, 3 NAT
 *   3. Complex — Enterprise: 4 zones, custom apps, security profiles, disabled rules, 20+ rules
 *   4. Edge Cases — Tricky constructs: FQDN, any/any, tags, application-default, dynamic groups
 *
 * SRX samples:
 *   5. SRX Basic — SRX set commands: 3 zones, address objects, 6 security policies, source NAT
 *
 * Azure NSG samples:
 *   Simple — Basic web app: 6 rules, HTTPS/HTTP/SSH allow, LB probe, deny-all
 *   Medium — 3-tier app: 14 rules, service tags, inter-tier restrictions, explicit outbound
 *   Complex — Enterprise hub-spoke: 22 rules, PCI micro-segmentation, port ranges, ICMP, compliance denies
 *
 * AWS Security Group samples:
 *   Simple — Single web-server SG: HTTP/HTTPS from internet, SSH from bastion, all egress
 *   Medium — 3-tier app: web/app/db SGs with cross-SG UserIdGroupPairs, port ranges, prefix list
 *   Complex — Enterprise 4-SG set: bastion, ALB, app, RDS; IPv6, PrefixLists, ICMP, ephemeral egress
 *
 * GCP Firewall Rules samples:
 *   Simple — Default VPC: IAP SSH, HTTP/HTTPS to tagged instances, internal allow, deny-all
 *   Medium — 3-tier app: web/app/db target tags, LB health checks, tag-to-tag rules, egress controls
 *   Complex — Enterprise multi-VPC: service accounts, prod+mgmt networks, priority ordering, disabled rules, logging
 *
 * Multi-context samples (for merge mode / auto-split):
 *   PAN-OS Multi-Vsys — 2 virtual systems (vsys1 + vsys2), triggers auto-split
 *   FortiGate Multi-VDOM — 2 VDOMs (root + guest), triggers auto-split
 *   SRX Logical-Systems — 2 logical-systems (LS-BRANCH + LS-DC), shared trust zone for cross-LS
 *   SRX Tenants — 1 tenant (TENANT-A), tests tenant parsing path
 */

export const SAMPLE_CONFIGS = {

  // =========================================================================
  // SAMPLE 1: Basic Small Office
  // =========================================================================
  basic: {
    vendor: 'panos',
    label: 'Basic (6 rules)',
    description: 'Small office: 2 zones, 5 address objects, 6 security rules, 1 source NAT, schedule',
    xml: `<?xml version="1.0"?>
<config version="10.1.0" urldb="paloaltonetworks">
  <devices>
    <entry name="localhost.localdomain">
      <deviceconfig>
        <high-availability>
          <enabled>yes</enabled>
          <group>
            <group-id>1</group-id>
            <mode><active-passive><passive-link-state>auto</passive-link-state></active-passive></mode>
            <peer-ip>10.0.1.2</peer-ip>
            <election-option>
              <device-priority>100</device-priority>
              <preemptive>yes</preemptive>
            </election-option>
          </group>
          <interface>
            <ha1><ip-address>10.10.0.1/24</ip-address><port>dedicated-ha1</port></ha1>
            <ha2><ip-address>10.10.1.1/24</ip-address><port>dedicated-ha2</port></ha2>
          </interface>
        </high-availability>
        <system>
          <syslog>
            <server-profile>
              <entry name="syslog-profile">
                <server>
                  <entry name="syslog-srv-1"><server>10.0.0.100</server><port>514</port><transport>UDP</transport><facility>LOG_USER</facility></entry>
                </server>
              </entry>
            </server-profile>
          </syslog>
        </system>
      </deviceconfig>
      <vsys>
        <entry name="vsys1">
          <zone>
            <entry name="trust">
              <network>
                <layer3>
                  <member>ethernet1/1</member>
                </layer3>
              </network>
            </entry>
            <entry name="untrust">
              <network>
                <layer3>
                  <member>ethernet1/2</member>
                </layer3>
              </network>
              <zone-protection-profile>zpp-untrust</zone-protection-profile>
            </entry>
          </zone>
          <address>
            <entry name="web-server-1">
              <ip-netmask>10.1.1.10/32</ip-netmask>
              <description>Primary web server</description>
            </entry>
            <entry name="web-server-2">
              <ip-netmask>10.1.1.11/32</ip-netmask>
              <description>Secondary web server</description>
            </entry>
            <entry name="db-server">
              <ip-netmask>10.1.2.20/32</ip-netmask>
              <description>PostgreSQL database</description>
            </entry>
            <entry name="internal-net">
              <ip-netmask>10.1.0.0/16</ip-netmask>
              <description>Internal network</description>
            </entry>
            <entry name="dns-server">
              <ip-netmask>10.1.1.5/32</ip-netmask>
              <description>Internal DNS resolver</description>
            </entry>
          </address>
          <service>
            <entry name="tcp-8443">
              <protocol>
                <tcp>
                  <port>8443</port>
                </tcp>
              </protocol>
              <description>Custom HTTPS alt port</description>
            </entry>
            <entry name="tcp-5432">
              <protocol>
                <tcp>
                  <port>5432</port>
                </tcp>
              </protocol>
              <description>PostgreSQL</description>
            </entry>
          </service>
          <rulebase>
            <security>
              <rules>
                <entry name="allow-outbound-web">
                  <from>
                    <member>trust</member>
                  </from>
                  <to>
                    <member>untrust</member>
                  </to>
                  <source>
                    <member>internal-net</member>
                  </source>
                  <destination>
                    <member>any</member>
                  </destination>
                  <source-user>
                    <member>CORP\IT-Admins</member>
                    <member>CORP\Engineering</member>
                  </source-user>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service>
                    <member>application-default</member>
                  </service>
                  <action>allow</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                  <profile-setting>
                    <profiles>
                      <virus><member>default</member></virus>
                      <spyware><member>strict</member></spyware>
                      <vulnerability><member>strict</member></vulnerability>
                      <url-filtering><member>default</member></url-filtering>
                      <wildfire-analysis><member>default</member></wildfire-analysis>
                    </profiles>
                  </profile-setting>
                </entry>
                <entry name="allow-dns">
                  <from>
                    <member>trust</member>
                  </from>
                  <to>
                    <member>untrust</member>
                  </to>
                  <source>
                    <member>dns-server</member>
                  </source>
                  <destination>
                    <member>any</member>
                  </destination>
                  <application>
                    <member>dns</member>
                  </application>
                  <service>
                    <member>application-default</member>
                  </service>
                  <action>allow</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                  <profile-setting>
                    <profiles>
                      <spyware><member>strict</member></spyware>
                    </profiles>
                  </profile-setting>
                </entry>
                <entry name="allow-inbound-https">
                  <from>
                    <member>untrust</member>
                  </from>
                  <to>
                    <member>trust</member>
                  </to>
                  <source>
                    <member>any</member>
                  </source>
                  <destination>
                    <member>web-server-1</member>
                    <member>web-server-2</member>
                  </destination>
                  <application>
                    <member>ssl</member>
                  </application>
                  <service>
                    <member>application-default</member>
                  </service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <profile-setting>
                    <profiles>
                      <virus><member>default</member></virus>
                      <spyware><member>strict</member></spyware>
                      <vulnerability><member>strict</member></vulnerability>
                      <file-blocking><member>basic file blocking</member></file-blocking>
                    </profiles>
                  </profile-setting>
                </entry>
                <entry name="allow-inbound-alt-https">
                  <from>
                    <member>untrust</member>
                  </from>
                  <to>
                    <member>trust</member>
                  </to>
                  <source>
                    <member>any</member>
                  </source>
                  <destination>
                    <member>web-server-1</member>
                  </destination>
                  <application>
                    <member>any</member>
                  </application>
                  <service>
                    <member>tcp-8443</member>
                  </service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <profile-setting>
                    <group><member>office-security</member></group>
                  </profile-setting>
                </entry>
                <entry name="allow-ssh-mgmt">
                  <from>
                    <member>trust</member>
                  </from>
                  <to>
                    <member>trust</member>
                  </to>
                  <source>
                    <member>internal-net</member>
                  </source>
                  <destination>
                    <member>web-server-1</member>
                    <member>web-server-2</member>
                    <member>db-server</member>
                  </destination>
                  <application>
                    <member>ssh</member>
                  </application>
                  <service>
                    <member>application-default</member>
                  </service>
                  <action>allow</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                  <schedule>business-hours</schedule>
                  <profile-setting>
                    <profiles>
                      <vulnerability><member>default</member></vulnerability>
                    </profiles>
                  </profile-setting>
                </entry>
                <entry name="deny-all">
                  <from>
                    <member>any</member>
                  </from>
                  <to>
                    <member>any</member>
                  </to>
                  <source>
                    <member>any</member>
                  </source>
                  <destination>
                    <member>any</member>
                  </destination>
                  <application>
                    <member>any</member>
                  </application>
                  <service>
                    <member>any</member>
                  </service>
                  <action>deny</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                </entry>
              </rules>
            </security>
            <nat>
              <rules>
                <entry name="outbound-nat">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/2</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <from>
                    <member>trust</member>
                  </from>
                  <to>
                    <member>untrust</member>
                  </to>
                  <source>
                    <member>any</member>
                  </source>
                  <destination>
                    <member>any</member>
                  </destination>
                </entry>
              </rules>
            </nat>
            <decryption>
              <rules>
                <entry name="decrypt-outbound-web">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>internal-net</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-forward-proxy/></type>
                  <profile>best-practice-decrypt</profile>
                  <log-success>yes</log-success>
                  <log-fail>yes</log-fail>
                  <description>Decrypt outbound SSL/TLS for inspection</description>
                </entry>
                <entry name="no-decrypt-finance">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>financial-services</member><member>health-and-medicine</member></category>
                  <action>no-decrypt</action>
                  <description>Exempt financial and health sites from decryption</description>
                </entry>
                <entry name="decrypt-inbound-webserver">
                  <from><member>untrust</member></from>
                  <to><member>trust</member></to>
                  <source><member>any</member></source>
                  <destination><member>web-server-1</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>application-default</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-inbound-inspection><ssl-certificate>webserver-cert</ssl-certificate></ssl-inbound-inspection></type>
                  <profile>inbound-decrypt-profile</profile>
                  <description>Decrypt inbound HTTPS to web server for IPS inspection</description>
                </entry>
              </rules>
            </decryption>
            <pbf>
              <rules>
                <entry name="route-guest-via-isp2">
                  <from><zone><member>trust</member></zone></from>
                  <source><member>internal-net</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/3</egress-interface>
                      <nexthop><ip-address>203.0.113.1</ip-address></nexthop>
                      <monitor><ip-address>203.0.113.1</ip-address><disable-if-unreachable>yes</disable-if-unreachable></monitor>
                    </forward>
                  </action>
                  <enforce-symmetric-return><enabled>yes</enabled></enforce-symmetric-return>
                  <description>Route guest WiFi traffic through ISP2 link</description>
                </entry>
                <entry name="voip-direct-route">
                  <from><zone><member>trust</member></zone></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>sip</member><member>rtp</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/4</egress-interface>
                      <nexthop><ip-address>10.0.100.1</ip-address></nexthop>
                    </forward>
                  </action>
                  <description>Route VoIP traffic through dedicated MPLS link</description>
                </entry>
              </rules>
            </pbf>
          </rulebase>
          <schedule>
            <entry name="business-hours">
              <schedule-type>
                <recurring>
                  <weekly>
                    <monday>08:00-18:00</monday>
                    <tuesday>08:00-18:00</tuesday>
                    <wednesday>08:00-18:00</wednesday>
                    <thursday>08:00-18:00</thursday>
                    <friday>08:00-18:00</friday>
                  </weekly>
                </recurring>
              </schedule-type>
            </entry>
          </schedule>
          <profiles>
            <virus>
              <entry name="default">
                <decoder><entry name="ftp"><action>default</action><wildfire-action>default</wildfire-action></entry><entry name="http"><action>default</action><wildfire-action>default</wildfire-action></entry><entry name="smb"><action>default</action><wildfire-action>default</wildfire-action></entry></decoder>
              </entry>
            </virus>
            <spyware>
              <entry name="strict">
                <rules><entry name="simple-critical"><severity><member>critical</member></severity><action><reset-both/></action></entry><entry name="simple-high"><severity><member>high</member></severity><action><reset-both/></action></entry><entry name="simple-medium"><severity><member>medium</member></severity><action><drop/></action></entry><entry name="simple-low"><severity><member>low</member></severity><action><alert/></action></entry></rules>
              </entry>
            </spyware>
            <vulnerability>
              <entry name="strict">
                <rules><entry name="simple-critical"><severity><member>critical</member></severity><action><reset-both/></action></entry><entry name="simple-high"><severity><member>high</member></severity><action><reset-both/></action></entry><entry name="simple-medium"><severity><member>medium</member></severity><action><drop/></action></entry></rules>
              </entry>
              <entry name="default">
                <rules><entry name="simple-critical"><severity><member>critical</member></severity><action><reset-both/></action></entry><entry name="simple-high"><severity><member>high</member></severity><action><alert/></action></entry></rules>
              </entry>
            </vulnerability>
            <url-filtering>
              <entry name="default">
                <block><member>adult</member><member>gambling</member><member>hacking</member><member>malware</member><member>phishing</member><member>command-and-control</member></block>
                <alert><member>social-networking</member><member>streaming-media</member></alert>
              </entry>
            </url-filtering>
            <file-blocking>
              <entry name="basic file blocking">
                <rules><entry name="block-executables"><application><member>any</member></application><file-type><member>exe</member><member>dll</member><member>bat</member></file-type><direction>both</direction><action>block</action></entry></rules>
              </entry>
            </file-blocking>
            <wildfire-analysis>
              <entry name="default">
                <rules><entry name="default-fwd"><application><member>any</member></application><file-type><member>any</member></file-type><direction>both</direction><analysis>public-cloud</analysis></entry></rules>
              </entry>
            </wildfire-analysis>
          </profiles>
          <profile-group>
            <entry name="office-security">
              <virus><member>default</member></virus>
              <spyware><member>strict</member></spyware>
              <vulnerability><member>strict</member></vulnerability>
              <url-filtering><member>default</member></url-filtering>
              <file-blocking><member>basic file blocking</member></file-blocking>
              <wildfire-analysis><member>default</member></wildfire-analysis>
            </entry>
          </profile-group>
        </entry>
      </vsys>
      <network>
        <profiles>
          <zone-protection-profile>
            <entry name="zpp-untrust">
              <flood>
                <tcp-syn><enable>yes</enable><red><alarm-rate>10000</alarm-rate><activate-rate>1000</activate-rate></red></tcp-syn>
                <icmp><enable>yes</enable><red><alarm-rate>5000</alarm-rate></red></icmp>
                <udp><enable>yes</enable><red><alarm-rate>5000</alarm-rate></red></udp>
              </flood>
            </entry>
          </zone-protection-profile>
        </profiles>
        <virtual-router>
        <entry name="default">
          <interface>
            <member>ethernet1/1</member>
            <member>ethernet1/2</member>
          </interface>
          <routing-table>
            <ip>
              <static-route>
                <entry name="default-route">
                  <destination>0.0.0.0/0</destination>
                  <nexthop>
                    <ip-address>10.0.1.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/1</interface>
                  <metric>10</metric>
                </entry>
                <entry name="server-subnet">
                  <destination>172.16.0.0/16</destination>
                  <nexthop>
                    <ip-address>10.0.2.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/2</interface>
                  <metric>10</metric>
                </entry>
              </static-route>
            </ip>
          </routing-table>
          <protocol>
            <bgp>
              <enable>yes</enable>
              <local-as>65010</local-as>
              <router-id>10.0.1.1</router-id>
              <peer-group>
                <entry name="EBGP-ISP">
                  <type><ebgp/></type>
                  <peer>
                    <entry name="203.0.113.2">
                      <peer-as>65100</peer-as>
                      <enable>yes</enable>
                      <local-address><interface>ethernet1/2</interface></local-address>
                    </entry>
                  </peer>
                </entry>
                <entry name="IBGP-CORE">
                  <type><ibgp/></type>
                  <peer>
                    <entry name="10.0.1.2">
                      <peer-as>65010</peer-as>
                      <enable>yes</enable>
                    </entry>
                  </peer>
                </entry>
              </peer-group>
            </bgp>
            <ospf>
              <enable>yes</enable>
              <router-id>10.0.1.1</router-id>
              <area>
                <entry name="0.0.0.0">
                  <interface>
                    <entry name="ethernet1/1">
                      <metric>10</metric>
                    </entry>
                    <entry name="loopback.1">
                      <passive>yes</passive>
                    </entry>
                  </interface>
                </entry>
                <entry name="0.0.0.1">
                  <type><stub/></type>
                  <interface>
                    <entry name="ethernet1/2"/>
                  </interface>
                </entry>
              </area>
            </ospf>
            <ospfv3>
              <enable>yes</enable>
              <router-id>10.0.1.1</router-id>
              <area>
                <entry name="0.0.0.0">
                  <interface>
                    <entry name="ethernet1/1">
                      <metric>10</metric>
                    </entry>
                    <entry name="loopback.1">
                      <passive>yes</passive>
                    </entry>
                  </interface>
                </entry>
                <entry name="0.0.0.3">
                  <type><nssa/></type>
                  <interface>
                    <entry name="ethernet1/3"/>
                  </interface>
                </entry>
              </area>
            </ospfv3>
          </protocol>
        </entry>
        </virtual-router>
        <ike>
          <crypto-profile>
            <ike-crypto-profiles>
              <entry name="ike-crypto-aes256">
                <encryption><member>aes-256-cbc</member></encryption>
                <hash><member>sha256</member></hash>
                <dh-group><member>group14</member></dh-group>
                <lifetime><hours>8</hours></lifetime>
              </entry>
            </ike-crypto-profiles>
            <ipsec-crypto-profiles>
              <entry name="ipsec-crypto-aes256">
                <esp>
                  <encryption><member>aes-256-cbc</member></encryption>
                  <authentication><member>sha256</member></authentication>
                </esp>
                <dh-group>group14</dh-group>
                <lifetime><hours>1</hours></lifetime>
              </entry>
            </ipsec-crypto-profiles>
          </crypto-profile>
          <gateway>
            <entry name="branch-gw">
              <authentication><pre-shared-key><key>SANITIZED</key></pre-shared-key></authentication>
              <peer-address><ip>203.0.113.50</ip></peer-address>
              <local-address><interface>ethernet1/2</interface></local-address>
            </entry>
          </gateway>
        </ike>
        <tunnel>
          <ipsec>
            <entry name="branch-tunnel">
              <auto-key>
                <ike-gateway><entry name="branch-gw"/></ike-gateway>
                <ipsec-crypto-profile>ipsec-crypto-aes256</ipsec-crypto-profile>
                <proxy-id>
                  <entry name="proxy-branch">
                    <local>10.1.0.0/16</local>
                    <remote>192.168.0.0/16</remote>
                  </entry>
                </proxy-id>
              </auto-key>
              <tunnel-interface>tunnel.1</tunnel-interface>
            </entry>
          </ipsec>
        </tunnel>
        <dhcp>
          <interface>
            <entry name="ethernet1/1">
              <server>
                <ip-pool><member>10.1.1.100-10.1.1.200</member></ip-pool>
                <option>
                  <gateway>10.1.1.1</gateway>
                  <dns-server><primary>8.8.8.8</primary><secondary>8.8.4.4</secondary></dns-server>
                  <lease><timeout>43200</timeout></lease>
                </option>
              </server>
            </entry>
          </interface>
        </dhcp>
        <qos>
          <profile>
            <entry name="qos-egress">
              <aggregate-bandwidth><egress-max>100000</egress-max></aggregate-bandwidth>
              <class>
                <entry name="class-realtime"><priority>real-time</priority><guaranteed-bandwidth>40000</guaranteed-bandwidth><maximum-bandwidth>60000</maximum-bandwidth></entry>
                <entry name="class-business"><priority>high</priority><guaranteed-bandwidth>30000</guaranteed-bandwidth><maximum-bandwidth>50000</maximum-bandwidth></entry>
              </class>
            </entry>
          </profile>
        </qos>
      </network>
    </entry>
  </devices>
</config>`,
  },

  // =========================================================================
  // SAMPLE 2: Medium Branch Office
  // =========================================================================
  medium: {
    vendor: 'panos',
    label: 'Medium (12 rules)',
    description: 'Branch office: 3 zones (trust/untrust/dmz), address groups, service objects, 12 rules, 3 NAT',
    xml: `<?xml version="1.0"?>
<config version="10.2.0" urldb="paloaltonetworks">
  <devices>
    <entry name="branch-fw-01">
      <vsys>
        <entry name="vsys1">
          <zone>
            <entry name="trust">
              <network>
                <layer3>
                  <member>ethernet1/1</member>
                </layer3>
              </network>
            </entry>
            <entry name="untrust">
              <network>
                <layer3>
                  <member>ethernet1/2</member>
                </layer3>
              </network>
            </entry>
            <entry name="dmz">
              <network>
                <layer3>
                  <member>ethernet1/3</member>
                </layer3>
              </network>
            </entry>
          </zone>
          <address>
            <entry name="app-server-1">
              <ip-netmask>172.16.10.10/32</ip-netmask>
            </entry>
            <entry name="app-server-2">
              <ip-netmask>172.16.10.11/32</ip-netmask>
            </entry>
            <entry name="mail-server">
              <ip-netmask>172.16.20.5/32</ip-netmask>
              <description>Exchange mail server</description>
            </entry>
            <entry name="proxy-server">
              <ip-netmask>172.16.20.10/32</ip-netmask>
            </entry>
            <entry name="dmz-web-1">
              <ip-netmask>192.168.100.10/32</ip-netmask>
              <description>Public web server in DMZ</description>
            </entry>
            <entry name="dmz-web-2">
              <ip-netmask>192.168.100.11/32</ip-netmask>
            </entry>
            <entry name="dmz-api">
              <ip-netmask>192.168.100.20/32</ip-netmask>
              <description>Public API gateway</description>
            </entry>
            <entry name="internal-subnet">
              <ip-netmask>172.16.0.0/16</ip-netmask>
            </entry>
            <entry name="dmz-subnet">
              <ip-netmask>192.168.100.0/24</ip-netmask>
            </entry>
            <entry name="partner-vpn-net">
              <ip-netmask>10.99.0.0/24</ip-netmask>
              <description>Partner VPN network range</description>
            </entry>
          </address>
          <address-group>
            <entry name="app-servers">
              <static>
                <member>app-server-1</member>
                <member>app-server-2</member>
              </static>
              <description>Application server cluster</description>
            </entry>
            <entry name="dmz-web-servers">
              <static>
                <member>dmz-web-1</member>
                <member>dmz-web-2</member>
              </static>
            </entry>
            <entry name="all-dmz-hosts">
              <static>
                <member>dmz-web-1</member>
                <member>dmz-web-2</member>
                <member>dmz-api</member>
              </static>
            </entry>
          </address-group>
          <service>
            <entry name="tcp-8080">
              <protocol>
                <tcp>
                  <port>8080</port>
                </tcp>
              </protocol>
              <description>HTTP alt port</description>
            </entry>
            <entry name="tcp-3000-3010">
              <protocol>
                <tcp>
                  <port>3000-3010</port>
                </tcp>
              </protocol>
              <description>Node.js app ports</description>
            </entry>
            <entry name="tcp-443-8443">
              <protocol>
                <tcp>
                  <port>443,8443</port>
                </tcp>
              </protocol>
              <description>HTTPS standard and alt</description>
            </entry>
            <entry name="udp-514">
              <protocol>
                <udp>
                  <port>514</port>
                </udp>
              </protocol>
              <description>Syslog</description>
            </entry>
          </service>
          <rulebase>
            <security>
              <rules>
                <entry name="trust-to-untrust-web">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>internal-subnet</member></source>
                  <destination><member>any</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="trust-to-untrust-dns">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>dns</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="trust-to-dmz-app">
                  <from><member>trust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>internal-subnet</member></source>
                  <destination><member>all-dmz-hosts</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="dmz-to-trust-db">
                  <from><member>dmz</member></from>
                  <to><member>trust</member></to>
                  <source><member>dmz-api</member></source>
                  <destination><member>app-servers</member></destination>
                  <application><member>any</member></application>
                  <service><member>tcp-3000-3010</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="untrust-to-dmz-https">
                  <from><member>untrust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>any</member></source>
                  <destination><member>dmz-web-servers</member></destination>
                  <application><member>ssl</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="untrust-to-dmz-api">
                  <from><member>untrust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>any</member></source>
                  <destination><member>dmz-api</member></destination>
                  <application><member>ssl</member></application>
                  <service><member>tcp-443-8443</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="trust-to-trust-ssh">
                  <from><member>trust</member></from>
                  <to><member>trust</member></to>
                  <source><member>internal-subnet</member></source>
                  <destination><member>app-servers</member></destination>
                  <application><member>ssh</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <schedule>business-hours</schedule>
                </entry>
                <entry name="trust-to-untrust-mail">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>mail-server</member></source>
                  <destination><member>any</member></destination>
                  <application>
                    <member>smtp</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="untrust-to-trust-mail-inbound">
                  <from><member>untrust</member></from>
                  <to><member>trust</member></to>
                  <source><member>any</member></source>
                  <destination><member>mail-server</member></destination>
                  <application><member>smtp</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="trust-to-untrust-syslog">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>partner-vpn-net</member></destination>
                  <application><member>syslog</member></application>
                  <service><member>udp-514</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="dmz-to-untrust-updates">
                  <from><member>dmz</member></from>
                  <to><member>untrust</member></to>
                  <source><member>all-dmz-hosts</member></source>
                  <destination><member>any</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <description>Allow DMZ servers to fetch OS updates</description>
                </entry>
                <entry name="deny-all">
                  <from><member>any</member></from>
                  <to><member>any</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>deny</action>
                  <log-end>yes</log-end>
                </entry>
              </rules>
            </security>
            <nat>
              <rules>
                <entry name="outbound-nat-trust">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/2</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                </entry>
                <entry name="outbound-nat-dmz">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/2</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <from><member>dmz</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                </entry>
                <entry name="inbound-nat-web">
                  <destination-translation>
                    <translated-address>192.168.100.10</translated-address>
                    <translated-port>443</translated-port>
                  </destination-translation>
                  <from><member>untrust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>dmz-web-1</member></destination>
                </entry>
              </rules>
            </nat>
            <decryption>
              <rules>
                <entry name="decrypt-outbound-ssl">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-forward-proxy/></type>
                  <profile>branch-decrypt-profile</profile>
                  <description>Decrypt outbound SSL for branch office users</description>
                </entry>
                <entry name="no-decrypt-banking">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>financial-services</member></category>
                  <action>no-decrypt</action>
                  <description>Exempt banking sites from SSL decryption</description>
                </entry>
              </rules>
            </decryption>
            <pbf>
              <rules>
                <entry name="dmz-traffic-isp1">
                  <from><zone><member>dmz</member></zone></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/2</egress-interface>
                      <nexthop><ip-address>198.51.100.1</ip-address></nexthop>
                      <monitor><ip-address>198.51.100.1</ip-address><disable-if-unreachable>yes</disable-if-unreachable></monitor>
                    </forward>
                  </action>
                  <description>Force DMZ outbound traffic through ISP1</description>
                </entry>
              </rules>
            </pbf>
          </rulebase>
          <schedule>
            <entry name="business-hours">
              <schedule-type>
                <recurring>
                  <weekly>
                    <monday>08:00-18:00</monday>
                    <tuesday>08:00-18:00</tuesday>
                    <wednesday>08:00-18:00</wednesday>
                    <thursday>08:00-18:00</thursday>
                    <friday>08:00-18:00</friday>
                  </weekly>
                </recurring>
              </schedule-type>
            </entry>
          </schedule>
        </entry>
      </vsys>
      <network>
        <virtual-router>
          <entry name="vr-branch">
          <interface>
            <member>ethernet1/1</member>
            <member>ethernet1/2</member>
            <member>ethernet1/3</member>
          </interface>
          <routing-table>
            <ip>
              <static-route>
                <entry name="default-route">
                  <destination>0.0.0.0/0</destination>
                  <nexthop>
                    <ip-address>203.0.113.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/1</interface>
                  <metric>10</metric>
                </entry>
                <entry name="hq-network">
                  <destination>10.0.0.0/8</destination>
                  <nexthop>
                    <ip-address>10.100.0.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/3</interface>
                  <metric>20</metric>
                </entry>
              </static-route>
            </ip>
          </routing-table>
        </entry>
        </virtual-router>
      </network>
    </entry>
  </devices>
</config>`,
  },

  // =========================================================================
  // SAMPLE 3: Complex Enterprise
  // =========================================================================
  complex: {
    vendor: 'panos',
    label: 'Complex (19 rules)',
    description: 'Enterprise: 4 zones, custom apps, security profiles (UTM/IDP), EDL threat feeds (SecIntel), disabled rules, tags',
    xml: `<?xml version="1.0"?>
<config version="11.0.0" urldb="paloaltonetworks">
  <devices>
    <entry name="dc-fw-primary">
      <vsys>
        <entry name="vsys1">
          <zone>
            <entry name="trust">
              <network><layer3><member>ethernet1/1</member></layer3></network>
            </entry>
            <entry name="untrust">
              <network><layer3><member>ethernet1/2</member></layer3></network>
            </entry>
            <entry name="dmz">
              <network><layer3><member>ethernet1/3</member></layer3></network>
            </entry>
            <entry name="mgmt">
              <network><layer3><member>ethernet1/4</member></layer3></network>
              <description>Management zone for network devices</description>
            </entry>
          </zone>
          <address>
            <entry name="dc-web-01"><ip-netmask>10.10.1.10/32</ip-netmask></entry>
            <entry name="dc-web-02"><ip-netmask>10.10.1.11/32</ip-netmask></entry>
            <entry name="dc-app-01"><ip-netmask>10.10.2.10/32</ip-netmask></entry>
            <entry name="dc-app-02"><ip-netmask>10.10.2.11/32</ip-netmask></entry>
            <entry name="dc-db-01"><ip-netmask>10.10.3.10/32</ip-netmask></entry>
            <entry name="dc-db-02"><ip-netmask>10.10.3.11/32</ip-netmask></entry>
            <entry name="jumpbox"><ip-netmask>10.10.99.5/32</ip-netmask><description>Bastion host</description></entry>
            <entry name="siem-server"><ip-netmask>10.10.99.10/32</ip-netmask></entry>
            <entry name="ntp-server"><ip-netmask>10.10.99.15/32</ip-netmask></entry>
            <entry name="internal-all"><ip-netmask>10.10.0.0/16</ip-netmask></entry>
            <entry name="dmz-net"><ip-netmask>192.168.200.0/24</ip-netmask></entry>
            <entry name="mgmt-net"><ip-netmask>10.10.99.0/24</ip-netmask></entry>
            <entry name="partner-net-a"><ip-netmask>10.200.1.0/24</ip-netmask><description>Partner A VPN</description></entry>
            <entry name="partner-net-b"><ip-netmask>10.200.2.0/24</ip-netmask><description>Partner B VPN</description></entry>
            <entry name="cdn-external"><fqdn>cdn.acmecorp.example.com</fqdn><description>CDN edge node</description></entry>
          </address>
          <address-group>
            <entry name="web-tier">
              <static>
                <member>dc-web-01</member>
                <member>dc-web-02</member>
              </static>
              <description>Web tier servers</description>
            </entry>
            <entry name="app-tier">
              <static>
                <member>dc-app-01</member>
                <member>dc-app-02</member>
              </static>
            </entry>
            <entry name="db-tier">
              <static>
                <member>dc-db-01</member>
                <member>dc-db-02</member>
              </static>
            </entry>
            <entry name="partner-networks">
              <static>
                <member>partner-net-a</member>
                <member>partner-net-b</member>
              </static>
            </entry>
          </address-group>
          <service>
            <entry name="tcp-8080"><protocol><tcp><port>8080</port></tcp></protocol></entry>
            <entry name="tcp-8443"><protocol><tcp><port>8443</port></tcp></protocol></entry>
            <entry name="tcp-3306"><protocol><tcp><port>3306</port></tcp></protocol><description>MySQL</description></entry>
            <entry name="tcp-5432"><protocol><tcp><port>5432</port></tcp></protocol><description>PostgreSQL</description></entry>
            <entry name="tcp-6379"><protocol><tcp><port>6379</port></tcp></protocol><description>Redis</description></entry>
            <entry name="tcp-9200"><protocol><tcp><port>9200</port></tcp></protocol><description>Elasticsearch</description></entry>
          </service>
          <application>
            <entry name="acme-internal-api">
              <description>ACME Corp internal REST API</description>
              <default>
                <port>
                  <member>tcp/8443</member>
                </port>
              </default>
            </entry>
            <entry name="acme-metrics">
              <description>ACME Corp metrics collection agent</description>
            </entry>
          </application>
          <external-list>
            <entry name="panw-bulletproof-ip-list">
              <type><predefined-ip><url>panw-bulletproof-ip-list</url></predefined-ip></type>
            </entry>
            <entry name="panw-highrisk-ip-list">
              <type><predefined-ip><url>panw-highrisk-ip-list</url></predefined-ip></type>
            </entry>
          </external-list>
          <rulebase>
            <security>
              <rules>
                <entry name="block-threat-feeds">
                  <from><member>untrust</member></from>
                  <to><member>trust</member><member>dmz</member></to>
                  <source><member>panw-bulletproof-ip-list</member><member>panw-highrisk-ip-list</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>deny</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>Block known malicious IPs from PAN-OS EDL feeds</description>
                </entry>
                <entry name="web-to-app-tier">
                  <from><member>dmz</member></from>
                  <to><member>trust</member></to>
                  <source><member>web-tier</member></source>
                  <destination><member>app-tier</member></destination>
                  <application><member>acme-internal-api</member></application>
                  <service><member>tcp-8443</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <tag><member>pci-scope</member><member>tier-link</member></tag>
                  <profile-setting>
                    <profiles>
                      <virus><member>default</member></virus>
                      <spyware><member>strict</member></spyware>
                      <vulnerability><member>strict</member></vulnerability>
                      <url-filtering><member>corporate-url-filter</member></url-filtering>
                      <file-blocking><member>strict file blocking</member></file-blocking>
                      <wildfire-analysis><member>default</member></wildfire-analysis>
                    </profiles>
                  </profile-setting>
                </entry>
                <entry name="app-to-db-mysql">
                  <from><member>trust</member></from>
                  <to><member>trust</member></to>
                  <source><member>app-tier</member></source>
                  <destination><member>dc-db-01</member></destination>
                  <application><member>any</member></application>
                  <service><member>tcp-3306</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <tag><member>pci-scope</member></tag>
                </entry>
                <entry name="app-to-db-postgres">
                  <from><member>trust</member></from>
                  <to><member>trust</member></to>
                  <source><member>app-tier</member></source>
                  <destination><member>dc-db-02</member></destination>
                  <application><member>any</member></application>
                  <service><member>tcp-5432</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <tag><member>pci-scope</member></tag>
                </entry>
                <entry name="app-to-redis">
                  <from><member>trust</member></from>
                  <to><member>trust</member></to>
                  <source><member>app-tier</member></source>
                  <destination><member>app-tier</member></destination>
                  <application><member>any</member></application>
                  <service><member>tcp-6379</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="inbound-web-https">
                  <from><member>untrust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>any</member></source>
                  <destination><member>web-tier</member></destination>
                  <application><member>ssl</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <profile-setting>
                    <profiles>
                      <virus><member>default</member></virus>
                      <spyware><member>strict</member></spyware>
                      <vulnerability><member>strict</member></vulnerability>
                    </profiles>
                  </profile-setting>
                </entry>
                <entry name="inbound-web-http-redirect">
                  <from><member>untrust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>any</member></source>
                  <destination><member>web-tier</member></destination>
                  <application><member>web-browsing</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <description>Allow HTTP for redirect to HTTPS</description>
                </entry>
                <entry name="mgmt-ssh-all">
                  <from><member>mgmt</member></from>
                  <to><member>trust</member><member>dmz</member></to>
                  <source><member>jumpbox</member></source>
                  <destination><member>any</member></destination>
                  <application><member>ssh</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="mgmt-to-siem">
                  <from><member>trust</member><member>dmz</member><member>mgmt</member></from>
                  <to><member>mgmt</member></to>
                  <source><member>any</member></source>
                  <destination><member>siem-server</member></destination>
                  <application><member>syslog</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="all-to-ntp">
                  <from><member>trust</member><member>dmz</member><member>mgmt</member></from>
                  <to><member>mgmt</member></to>
                  <source><member>any</member></source>
                  <destination><member>ntp-server</member></destination>
                  <application><member>ntp</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="trust-to-dns">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>internal-all</member></source>
                  <destination><member>any</member></destination>
                  <application><member>dns</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="outbound-web">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>internal-all</member></source>
                  <destination><member>any</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="partner-a-access">
                  <from><member>untrust</member></from>
                  <to><member>trust</member></to>
                  <source><member>partner-net-a</member></source>
                  <destination><member>app-tier</member></destination>
                  <application><member>acme-internal-api</member></application>
                  <service><member>tcp-8443</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>Partner A API integration</description>
                </entry>
                <entry name="partner-b-access">
                  <from><member>untrust</member></from>
                  <to><member>trust</member></to>
                  <source><member>partner-net-b</member></source>
                  <destination><member>app-tier</member></destination>
                  <application><member>acme-internal-api</member></application>
                  <service><member>tcp-8443</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>Partner B API integration</description>
                </entry>
                <entry name="elasticsearch-access">
                  <from><member>trust</member></from>
                  <to><member>trust</member></to>
                  <source><member>app-tier</member></source>
                  <destination><member>siem-server</member></destination>
                  <application><member>any</member></application>
                  <service><member>tcp-9200</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="dmz-outbound-updates">
                  <from><member>dmz</member></from>
                  <to><member>untrust</member></to>
                  <source><member>dmz-net</member></source>
                  <destination><member>any</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <description>DMZ OS/package updates</description>
                </entry>
                <entry name="deprecated-ftp-rule">
                  <from><member>trust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>internal-all</member></source>
                  <destination><member>dmz-net</member></destination>
                  <application><member>ftp</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <disabled>yes</disabled>
                  <log-end>yes</log-end>
                  <description>DEPRECATED - migrated to SFTP</description>
                </entry>
                <entry name="old-test-rule">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>allow</action>
                  <disabled>yes</disabled>
                  <log-end>yes</log-end>
                  <description>DISABLED - was used for testing</description>
                </entry>
                <entry name="deny-all">
                  <from><member>any</member></from>
                  <to><member>any</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>deny</action>
                  <log-end>yes</log-end>
                </entry>
              </rules>
            </security>
            <nat>
              <rules>
                <entry name="outbound-snat">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/2</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                </entry>
                <entry name="dmz-outbound-snat">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/2</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <from><member>dmz</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                </entry>
                <entry name="inbound-dnat-web">
                  <destination-translation>
                    <translated-address>10.10.1.10</translated-address>
                    <translated-port>443</translated-port>
                  </destination-translation>
                  <from><member>untrust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>dc-web-01</member></destination>
                </entry>
              </rules>
            </nat>
            <decryption>
              <rules>
                <entry name="decrypt-all-outbound">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-forward-proxy/></type>
                  <profile>enterprise-decrypt-profile</profile>
                  <description>Decrypt all outbound SSL traffic from corporate users</description>
                </entry>
                <entry name="no-decrypt-executive">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category>
                    <member>financial-services</member>
                    <member>health-and-medicine</member>
                  </category>
                  <action>no-decrypt</action>
                  <description>Exempt financial and healthcare sites from decryption for compliance</description>
                </entry>
                <entry name="decrypt-inbound-dc">
                  <from><member>untrust</member></from>
                  <to><member>dmz</member></to>
                  <source><member>any</member></source>
                  <destination><member>dc-web-01</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-inbound-inspection><ssl-certificate>dc-web-cert</ssl-certificate></ssl-inbound-inspection></type>
                  <description>Decrypt inbound TLS to datacenter web servers for IPS inspection</description>
                </entry>
              </rules>
            </decryption>
            <pbf>
              <rules>
                <entry name="mgmt-traffic-oob">
                  <from><zone><member>mgmt</member></zone></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/5</egress-interface>
                      <nexthop><ip-address>172.16.0.1</ip-address></nexthop>
                    </forward>
                  </action>
                  <description>Route management traffic through out-of-band network</description>
                </entry>
                <entry name="backup-via-mpls">
                  <from><zone><member>trust</member></zone></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/6</egress-interface>
                      <nexthop><ip-address>10.255.0.1</ip-address></nexthop>
                    </forward>
                  </action>
                  <description>Force backup replication traffic over MPLS link</description>
                </entry>
              </rules>
            </pbf>
          </rulebase>
        </entry>
      </vsys>
      <network>
        <virtual-router>
          <entry name="default">
            <interface>
              <member>ethernet1/1</member>
              <member>ethernet1/2</member>
              <member>ethernet1/3</member>
              <member>ethernet1/4</member>
          </interface>
          <routing-table>
            <ip>
              <static-route>
                <entry name="default-gw">
                  <destination>0.0.0.0/0</destination>
                  <nexthop>
                    <ip-address>198.51.100.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/1</interface>
                  <metric>10</metric>
                </entry>
                <entry name="dc-servers">
                  <destination>10.10.0.0/16</destination>
                  <nexthop>
                    <ip-address>10.1.0.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/3</interface>
                  <metric>10</metric>
                </entry>
                <entry name="blackhole-bogons">
                  <destination>192.0.2.0/24</destination>
                  <nexthop>
                    <discard/>
                  </nexthop>
                  <metric>11</metric>
                </entry>
              </static-route>
            </ip>
          </routing-table>
        </entry>
        <entry name="vr-dmz">
          <interface>
            <member>ethernet1/4</member>
          </interface>
          <routing-table>
            <ip>
              <static-route>
                <entry name="dmz-to-default">
                  <destination>0.0.0.0/0</destination>
                  <nexthop>
                    <next-vr>default</next-vr>
                  </nexthop>
                  <metric>10</metric>
                </entry>
              </static-route>
            </ip>
          </routing-table>
        </entry>
        </virtual-router>
      </network>
    </entry>
  </devices>
</config>`,
  },

  // =========================================================================
  // SAMPLE 4: Edge Cases
  // =========================================================================
  edgeCases: {
    vendor: 'panos',
    label: 'Edge Cases (8 rules)',
    description: 'Tricky constructs: FQDN objects, any/any, tags, dynamic groups, drop actions, IP ranges',
    xml: `<?xml version="1.0"?>
<config version="10.1.0" urldb="paloaltonetworks">
  <devices>
    <entry name="edge-test-fw">
      <vsys>
        <entry name="vsys1">
          <zone>
            <entry name="inside">
              <network><layer3><member>ethernet1/1</member></layer3></network>
            </entry>
            <entry name="outside">
              <network><layer3><member>ethernet1/2</member></layer3></network>
            </entry>
          </zone>
          <address>
            <entry name="cloud-api">
              <fqdn>api.cloudservice.example.com</fqdn>
              <description>External cloud API endpoint</description>
            </entry>
            <entry name="cdn-edge">
              <fqdn>edge.cdn.example.com</fqdn>
            </entry>
            <entry name="scanner-range">
              <ip-range>10.50.0.1-10.50.0.254</ip-range>
              <description>Vulnerability scanner pool</description>
            </entry>
            <entry name="legacy-server">
              <ip-netmask>10.1.100.5/32</ip-netmask>
              <description>Legacy server - decomm scheduled</description>
            </entry>
            <entry name="user-vlan">
              <ip-netmask>10.1.0.0/22</ip-netmask>
            </entry>
            <entry name="server-vlan">
              <ip-netmask>10.1.100.0/24</ip-netmask>
            </entry>
          </address>
          <address-group>
            <entry name="dynamic-cloud-hosts">
              <dynamic>
                <filter>'cloud-tagged'</filter>
              </dynamic>
              <description>Dynamic group based on cloud tags</description>
            </entry>
            <entry name="all-servers">
              <static>
                <member>legacy-server</member>
                <member>server-vlan</member>
              </static>
            </entry>
          </address-group>
          <service>
            <entry name="tcp-9090">
              <protocol><tcp><port>9090</port></tcp></protocol>
              <description>Prometheus metrics</description>
            </entry>
          </service>
          <rulebase>
            <security>
              <rules>
                <entry name="any-any-permit-test">
                  <from><member>any</member></from>
                  <to><member>any</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>allow</action>
                  <disabled>yes</disabled>
                  <log-end>yes</log-end>
                  <description>DISABLED test rule - do not enable</description>
                  <tag><member>test</member><member>do-not-delete</member></tag>
                </entry>
                <entry name="cloud-api-access">
                  <from><member>inside</member></from>
                  <to><member>outside</member></to>
                  <source><member>server-vlan</member></source>
                  <destination><member>cloud-api</member></destination>
                  <application><member>ssl</member></application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>Servers to cloud API over HTTPS</description>
                </entry>
                <entry name="cdn-access">
                  <from><member>inside</member></from>
                  <to><member>outside</member></to>
                  <source><member>user-vlan</member></source>
                  <destination><member>cdn-edge</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="scanner-to-servers">
                  <from><member>inside</member></from>
                  <to><member>inside</member></to>
                  <source><member>scanner-range</member></source>
                  <destination><member>all-servers</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>allow</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>Vulnerability scanning access</description>
                  <tag><member>security-scanning</member></tag>
                </entry>
                <entry name="drop-inbound-scanners">
                  <from><member>outside</member></from>
                  <to><member>inside</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>tcp-9090</member></service>
                  <action>drop</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>Drop external attempts to reach metrics</description>
                </entry>
                <entry name="reset-bad-actors">
                  <from><member>outside</member></from>
                  <to><member>inside</member></to>
                  <source><member>any</member></source>
                  <destination><member>legacy-server</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>reset-both</action>
                  <log-start>yes</log-start>
                  <log-end>yes</log-end>
                  <description>RST connection attempts to decommissioned server</description>
                </entry>
                <entry name="outbound-general">
                  <from><member>inside</member></from>
                  <to><member>outside</member></to>
                  <source><member>user-vlan</member></source>
                  <destination><member>any</member></destination>
                  <application>
                    <member>web-browsing</member>
                    <member>ssl</member>
                    <member>dns</member>
                  </application>
                  <service><member>application-default</member></service>
                  <action>allow</action>
                  <log-end>yes</log-end>
                </entry>
                <entry name="deny-all">
                  <from><member>any</member></from>
                  <to><member>any</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>deny</action>
                  <log-end>yes</log-end>
                </entry>
              </rules>
            </security>
            <nat>
              <rules>
                <entry name="outbound-snat">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/2</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <from><member>inside</member></from>
                  <to><member>outside</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                </entry>
              </rules>
            </nat>
            <decryption>
              <rules>
                <entry name="decrypt-disabled-test">
                  <from><member>inside</member></from>
                  <to><member>outside</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-forward-proxy/></type>
                  <profile>test-decrypt-profile</profile>
                  <disabled>yes</disabled>
                  <description>Disabled decrypt rule for testing edge case</description>
                </entry>
                <entry name="no-decrypt-pinned-certs">
                  <from><member>inside</member></from>
                  <to><member>outside</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>no-decrypt</action>
                  <description>Exempt cert-pinned applications from decryption</description>
                </entry>
              </rules>
            </decryption>
            <pbf>
              <rules>
                <entry name="pbf-discard-blackhole">
                  <from><zone><member>inside</member></zone></from>
                  <source><member>any</member></source>
                  <destination><member>bogon-ranges</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action><discard/></action>
                  <description>Blackhole traffic to bogon ranges</description>
                </entry>
              </rules>
            </pbf>
          </rulebase>
        </entry>
      </vsys>
      <network>
        <virtual-router>
          <entry name="default">
            <interface>
              <member>ethernet1/1</member>
              <member>ethernet1/2</member>
            <member>ethernet1/5</member>
          </interface>
          <routing-table>
            <ip>
              <static-route>
                <entry name="default-route">
                  <destination>0.0.0.0/0</destination>
                  <nexthop>
                    <ip-address>192.168.1.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/1</interface>
                  <metric>10</metric>
                </entry>
                <entry name="null-route">
                  <destination>10.255.255.0/24</destination>
                  <nexthop>
                    <discard/>
                  </nexthop>
                  <metric>11</metric>
                </entry>
              </static-route>
            </ip>
          </routing-table>
        </entry>
        </virtual-router>
      </network>
    </entry>
  </devices>
</config>`,
  },

  // =========================================================================
  // SAMPLE 5: Real-World Production (sanitized)
  // =========================================================================
  realworld: {
    vendor: 'panos',
    label: 'Real-World (23 rules)',
    description: 'Production PA-440: 5 zones, EDL threat feeds, geo-negate blocking, 3 security profile groups, VPN tunnel zone, application groups, 23 security rules, 3 NAT rules',
    xml: `<?xml version="1.0"?>
<config version="11.1.0" urldb="paloaltonetworks">
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <application-group>
            <entry name="MGT-Applications">
              <members>
                <member>icmp</member>
                <member>ssh</member>
                <member>ssl</member>
                <member>web-browsing</member>
                <member>ping</member>
              </members>
            </entry>
            <entry name="AC-Internet-Applications">
              <members>
                <member>adobe-cloud</member>
                <member>apple-push-notifications</member>
                <member>boxnet</member>
                <member>dns</member>
                <member>dns-over-https</member>
                <member>dropbox</member>
                <member>facebook</member>
                <member>gmail</member>
                <member>google-base</member>
                <member>google-play</member>
                <member>icloud</member>
                <member>lastpass</member>
                <member>ldap</member>
                <member>linkedin</member>
                <member>ms-office365</member>
                <member>ms-onedrive</member>
                <member>ms-teams</member>
                <member>ms-update</member>
                <member>ntp</member>
                <member>ocsp</member>
                <member>outlook-web-online</member>
                <member>ping</member>
                <member>quic</member>
                <member>sharepoint-online</member>
                <member>spotify</member>
                <member>ssl</member>
                <member>stun</member>
                <member>web-browsing</member>
                <member>windows-azure</member>
                <member>zoom</member>
              </members>
            </entry>
            <entry name="PaloAlto-Applications">
              <members>
                <member>dns</member>
                <member>google-base</member>
                <member>ntp</member>
                <member>ocsp</member>
                <member>paloalto-device-telemetry</member>
                <member>paloalto-dns-security</member>
                <member>paloalto-shared-services</member>
                <member>paloalto-updates</member>
                <member>paloalto-wildfire-cloud</member>
                <member>pan-db-cloud</member>
                <member>panorama</member>
                <member>ssl</member>
                <member>web-browsing</member>
              </members>
            </entry>
          </application-group>
          <zone>
            <entry name="Internet-Side">
              <network>
                <layer3>
                  <member>ethernet1/1</member>
                </layer3>
              </network>
            </entry>
            <entry name="Default-LAN-Side">
              <network>
                <layer3>
                  <member>ethernet1/2</member>
                  <member>tunnel.1</member>
                </layer3>
              </network>
            </entry>
            <entry name="MGT-Net">
              <network>
                <layer3>
                  <member>ethernet1/8</member>
                </layer3>
              </network>
            </entry>
            <entry name="DMZ">
              <network>
                <layer3>
                  <member>ethernet1/7</member>
                </layer3>
              </network>
            </entry>
            <entry name="Server-Network">
              <network>
                <layer3>
                  <member>ethernet1/3</member>
                </layer3>
              </network>
            </entry>
          </zone>
          <service>
            <entry name="Panorama-SSL-3978">
              <protocol><tcp><port>443,3978</port><override><no/></override></tcp></protocol>
            </entry>
            <entry name="DirectoryLDAP">
              <protocol><tcp><port>636</port><override><no/></override></tcp></protocol>
            </entry>
            <entry name="BackupCloud-Endpoint-Mgr">
              <protocol><tcp><port>9079</port><override><no/></override></tcp></protocol>
              <description>Backup Endpoint Manager</description>
            </entry>
            <entry name="BackupCloud-Server">
              <protocol><tcp><port>9082</port><override><no/></override></tcp></protocol>
              <description>Backup Cloud Server</description>
            </entry>
            <entry name="BackupCloud-DRAL">
              <protocol><tcp><port>9083</port><override><no/></override></tcp></protocol>
              <description>Backup Disaster Recovery Access Layer</description>
            </entry>
            <entry name="BackupCloud-Manager">
              <protocol><tcp><port>9090</port><override><no/></override></tcp></protocol>
              <description>Backup Manager</description>
            </entry>
            <entry name="NAS-Web-Admin-5000">
              <protocol><tcp><port>5000</port><override><no/></override></tcp></protocol>
              <description>NAS Server Web Admin</description>
            </entry>
            <entry name="ssl4318">
              <protocol><tcp><port>4318</port><override><no/></override></tcp></protocol>
            </entry>
            <entry name="rdp-3389">
              <protocol><tcp><port>3389</port><override><no/></override></tcp></protocol>
            </entry>
            <entry name="gpu-cluster-8443">
              <protocol><tcp><port>8443</port><override><no/></override></tcp></protocol>
            </entry>
          </service>
          <service-group>
            <entry name="BackupCloud-D2C-Services">
              <members>
                <member>BackupCloud-Manager</member>
                <member>BackupCloud-Server</member>
                <member>BackupCloud-DRAL</member>
                <member>BackupCloud-Endpoint-Mgr</member>
                <member>service-http</member>
                <member>service-https</member>
              </members>
            </entry>
            <entry name="AC-Services-Internal-NAS">
              <members>
                <member>NAS-Web-Admin-5000</member>
              </members>
            </entry>
          </service-group>
          <rulebase>
            <security>
              <rules>
                <entry name="DROP Inbound Bulletproof High Risk">
                  <to><member>any</member></to>
                  <from><member>any</member></from>
                  <source>
                    <member>panw-bulletproof-ip-list</member>
                    <member>panw-highrisk-ip-list</member>
                    <member>panw-known-ip-list</member>
                    <member>panw-torexit-ip-list</member>
                  </source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>drop</action>
                </entry>
                <entry name="DROP Inbound Countries - Negate">
                  <to><member>any</member></to>
                  <from><member>any</member></from>
                  <source>
                    <member>10.0.0.0-10.255.255.255</member>
                    <member>172.16.0.0-172.31.255.255</member>
                    <member>192.168.0.0-192.168.255.255</member>
                    <member>AU</member>
                    <member>MY</member>
                    <member>US</member>
                  </source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>drop</action>
                  <negate-source>yes</negate-source>
                  <description>Drop ALL inbound countries except listed here including US and private ranges. Addresses are negated from Any.</description>
                </entry>
                <entry name="DROP Outbound Bulletproof High Risk">
                  <to><member>any</member></to>
                  <from><member>any</member></from>
                  <source><member>any</member></source>
                  <destination>
                    <member>panw-bulletproof-ip-list</member>
                    <member>panw-highrisk-ip-list</member>
                    <member>panw-known-ip-list</member>
                    <member>panw-torexit-ip-list</member>
                  </destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>drop</action>
                </entry>
                <entry name="DROP Outbound Countries - Negate">
                  <to><member>any</member></to>
                  <from><member>any</member></from>
                  <source><member>any</member></source>
                  <destination>
                    <member>10.0.0.0-10.255.255.255</member>
                    <member>172.16.0.0-172.31.255.255</member>
                    <member>192.168.0.0-192.168.255.255</member>
                    <member>AU</member>
                    <member>CA</member>
                    <member>DE</member>
                    <member>EU</member>
                    <member>GB</member>
                    <member>JP</member>
                    <member>US</member>
                  </destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>drop</action>
                  <negate-destination>yes</negate-destination>
                  <disabled>no</disabled>
                </entry>
                <entry name="ALLOW PaloAlto-Applications">
                  <from><member>MGT-Net</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <service><member>application-default</member></service>
                  <application><member>PaloAlto-Applications</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW PaloAlto-Panorama-SSL">
                  <from><member>MGT-Net</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>Cloud-Panorama</member></destination>
                  <service><member>application-default</member></service>
                  <application>
                    <member>panorama</member>
                    <member>ssl</member>
                  </application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                  <log-start>no</log-start>
                </entry>
                <entry name="ALLOW PaloAlto-Panorama-SSL-TEMP-OPEN">
                  <from><member>MGT-Net</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>Cloud-Panorama</member></destination>
                  <service><member>any</member></service>
                  <application><member>any</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <log-start>no</log-start>
                </entry>
                <entry name="ALLOW Server-Directory">
                  <from><member>Server-Network</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>Server-Gamma</member></source>
                  <destination>
                    <member>ldap-mfa.idp.example.com</member>
                    <member>ldap.idp.example.com</member>
                  </destination>
                  <service><member>DirectoryLDAP</member></service>
                  <application>
                    <member>ldap</member>
                    <member>ssl</member>
                  </application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW FW-Directory">
                  <from><member>MGT-Net</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination>
                    <member>ldap-mfa.idp.example.com</member>
                    <member>ldap.idp.example.com</member>
                  </destination>
                  <service><member>DirectoryLDAP</member></service>
                  <application>
                    <member>ldap</member>
                    <member>ssl</member>
                  </application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW MGT from Local LAN">
                  <from><member>Default-LAN-Side</member></from>
                  <to><member>MGT-Net</member></to>
                  <source><member>AC-Network</member></source>
                  <destination><member>MGT-Network</member></destination>
                  <service><member>application-default</member></service>
                  <application><member>MGT-Applications</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW AC Server Internet Apps">
                  <from><member>Server-Network</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>AC-Servers</member></source>
                  <destination><member>any</member></destination>
                  <service><member>application-default</member></service>
                  <application><member>ssl</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>NAS-Cloud-Domains</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                  <disabled>no</disabled>
                </entry>
                <entry name="ALLOW AC Internet Applications">
                  <from><member>Default-LAN-Side</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>AC-Network</member></source>
                  <destination><member>any</member></destination>
                  <service><member>application-default</member></service>
                  <application><member>AC-Internet-Applications</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW AC Internal Apps NAS">
                  <from><member>Default-LAN-Side</member></from>
                  <to><member>Server-Network</member></to>
                  <source><member>AC-Network</member></source>
                  <destination><member>Server-Gamma</member></destination>
                  <service><member>AC-Services-Internal-NAS</member></service>
                  <application><member>any</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                  <source-hip><member>any</member></source-hip>
                  <disabled>no</disabled>
                </entry>
                <entry name="ALLOW AC Internal SMB">
                  <from>
                    <member>Default-LAN-Side</member>
                    <member>Server-Network</member>
                  </from>
                  <to>
                    <member>Default-LAN-Side</member>
                    <member>Server-Network</member>
                  </to>
                  <source>
                    <member>AC-Network</member>
                    <member>AC-Server-Network</member>
                  </source>
                  <destination>
                    <member>AC-Server-Network</member>
                    <member>AC-Servers</member>
                  </destination>
                  <service><member>any</member></service>
                  <application>
                    <member>4shared</member>
                    <member>ms-ds-smb-base</member>
                    <member>ms-ds-smbv2</member>
                    <member>ms-ds-smbv3</member>
                    <member>netbios-dg</member>
                    <member>netbios-ns</member>
                    <member>netbios-ss</member>
                    <member>print-over-ms-smb</member>
                    <member>ssl</member>
                    <member>web-browsing</member>
                  </application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <destination-hip><member>any</member></destination-hip>
                  <source-hip><member>any</member></source-hip>
                  <option>
                    <disable-server-response-inspection>yes</disable-server-response-inspection>
                  </option>
                </entry>
                <entry name="ALLOW AC Internal Applications">
                  <from><member>Default-LAN-Side</member></from>
                  <to><member>Server-Network</member></to>
                  <source><member>AC-Network</member></source>
                  <destination><member>AC-Servers</member></destination>
                  <service><member>application-default</member></service>
                  <application><member>any</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Internal</member></group>
                  </profile-setting>
                  <source-hip><member>any</member></source-hip>
                </entry>
                <entry name="ALLOW BackupCloud D2C">
                  <from>
                    <member>Default-LAN-Side</member>
                    <member>Server-Network</member>
                  </from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>BackupCloud IP Addresses</member></destination>
                  <service><member>BackupCloud-D2C-Services</member></service>
                  <application><member>any</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW Outbound All">
                  <from>
                    <member>Default-LAN-Side</member>
                    <member>MGT-Net</member>
                    <member>Server-Network</member>
                  </from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <service><member>application-default</member></service>
                  <application><member>any</member></application>
                  <action>allow</action>
                  <log-end>yes</log-end>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
                <entry name="ALLOW from LAN to Server SSH">
                  <to><member>Server-Network</member></to>
                  <from><member>Default-LAN-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>ssh</member></application>
                  <service><member>any</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>allow</action>
                </entry>
                <entry name="ALLOW from LAN cotp">
                  <to><member>Server-Network</member></to>
                  <from><member>Default-LAN-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>cotp</member></application>
                  <service><member>application-default</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>allow</action>
                </entry>
                <entry name="ALLOW from LAN ssl on 4318">
                  <to><member>Server-Network</member></to>
                  <from><member>Default-LAN-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>ssl</member></application>
                  <service><member>ssl4318</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>allow</action>
                </entry>
                <entry name="ALLOW from LAN t120 and rdp on 3389">
                  <to><member>Server-Network</member></to>
                  <from><member>Default-LAN-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application>
                    <member>ms-rdp</member>
                    <member>t.120</member>
                  </application>
                  <service><member>rdp-3389</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>allow</action>
                </entry>
                <entry name="Allow inbound for Web App">
                  <to><member>Server-Network</member></to>
                  <from><member>Internet-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>Web-App-Public-Host</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>any</member></application>
                  <service><member>application-default</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>allow</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="Allow from user to server">
                  <to><member>Server-Network</member></to>
                  <from><member>Default-LAN-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <category><member>any</member></category>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <source-hip><member>any</member></source-hip>
                  <destination-hip><member>any</member></destination-hip>
                  <action>allow</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                </entry>
              </rules>
            </security>
            <nat>
              <rules>
                <entry name="Internet Outgoing NAT Policy">
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address>
                        <interface>ethernet1/1</interface>
                      </interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                  <to><member>Internet-Side</member></to>
                  <from>
                    <member>Default-LAN-Side</member>
                    <member>MGT-Net</member>
                    <member>Server-Network</member>
                  </from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <service>any</service>
                  <description>Internet Outgoing NAT Policy</description>
                  <to-interface>any</to-interface>
                </entry>
                <entry name="NAT-WebApp-Inbound">
                  <to><member>Internet-Side</member></to>
                  <from><member>Internet-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>Web-App-Public-Host</member></destination>
                  <service>any</service>
                  <description>NAT rule for inbound web application traffic.</description>
                  <to-interface>any</to-interface>
                  <destination-translation>
                    <translated-address>Server-Delta</translated-address>
                  </destination-translation>
                </entry>
                <entry name="NAT-WebApp-HTTP">
                  <to><member>Internet-Side</member></to>
                  <from><member>Internet-Side</member></from>
                  <source><member>any</member></source>
                  <destination><member>Web-App-Public-Host</member></destination>
                  <service>service-http</service>
                  <description>NAT rule for HTTP web application with port translation.</description>
                  <to-interface>any</to-interface>
                  <destination-translation>
                    <translated-port>80</translated-port>
                    <translated-address>Server-Delta</translated-address>
                  </destination-translation>
                  <disabled>yes</disabled>
                </entry>
              </rules>
            </nat>
            <decryption>
              <rules>
                <entry name="decrypt-user-traffic">
                  <from><member>Default-LAN-Side</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-forward-proxy/></type>
                  <profile>Acme-Decrypt-Profile</profile>
                  <log-success>yes</log-success>
                  <log-fail>yes</log-fail>
                  <description>Decrypt all outbound user SSL/TLS traffic for inspection</description>
                </entry>
                <entry name="no-decrypt-medical">
                  <from><member>Default-LAN-Side</member></from>
                  <to><member>Internet-Side</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>any</member></service>
                  <category><member>health-and-medicine</member></category>
                  <action>no-decrypt</action>
                  <description>Exempt healthcare and medical sites from SSL decryption</description>
                </entry>
                <entry name="decrypt-inbound-web">
                  <from><member>Internet-Side</member></from>
                  <to><member>Server-Network</member></to>
                  <source><member>any</member></source>
                  <destination><member>AC-Servers</member></destination>
                  <source-user><member>any</member></source-user>
                  <service><member>application-default</member></service>
                  <category><member>any</member></category>
                  <action>decrypt</action>
                  <type><ssl-inbound-inspection><ssl-certificate>web-frontend-cert</ssl-certificate></ssl-inbound-inspection></type>
                  <profile>Acme-Inbound-Decrypt</profile>
                  <description>Decrypt inbound HTTPS to web servers for IPS inspection</description>
                </entry>
              </rules>
            </decryption>
            <pbf>
              <rules>
                <entry name="guest-wifi-isp2">
                  <from><zone><member>Default-LAN-Side</member></zone></from>
                  <source><member>AC-Network</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>any</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/8</egress-interface>
                      <nexthop><ip-address>203.0.113.1</ip-address></nexthop>
                      <monitor><ip-address>203.0.113.1</ip-address><disable-if-unreachable>yes</disable-if-unreachable></monitor>
                    </forward>
                  </action>
                  <enforce-symmetric-return><enabled>yes</enabled></enforce-symmetric-return>
                  <description>Route guest WiFi traffic through secondary ISP link</description>
                </entry>
                <entry name="voip-mpls-route">
                  <from><zone><member>Default-LAN-Side</member></zone></from>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <source-user><member>any</member></source-user>
                  <application><member>sip</member><member>rtp</member></application>
                  <service><member>any</member></service>
                  <action>
                    <forward>
                      <egress-interface>ethernet1/9</egress-interface>
                      <nexthop><ip-address>10.200.0.1</ip-address></nexthop>
                    </forward>
                  </action>
                  <description>Route VoIP traffic through dedicated MPLS circuit</description>
                </entry>
              </rules>
            </pbf>
            <default-security-rules>
              <rules>
                <entry name="interzone-default">
                  <action>deny</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                </entry>
                <entry name="intrazone-default">
                  <action>allow</action>
                  <log-start>no</log-start>
                  <log-end>yes</log-end>
                  <profile-setting>
                    <group><member>Acme-Security-Profile</member></group>
                  </profile-setting>
                </entry>
              </rules>
            </default-security-rules>
          </rulebase>
          <address>
            <entry name="ISP-WAN-Link">
              <ip-netmask>198.51.100.9/27</ip-netmask>
              <description>Acme Corp WAN Connection</description>
            </entry>
            <entry name="AC-GW">
              <ip-netmask>10.10.10.1/24</ip-netmask>
            </entry>
            <entry name="MGT-GW">
              <ip-netmask>172.31.255.1/25</ip-netmask>
              <description>Management Network</description>
            </entry>
            <entry name="ISP-Gateway">
              <ip-netmask>198.51.100.1</ip-netmask>
              <description>Default Route</description>
            </entry>
            <entry name="AC-Network">
              <ip-netmask>10.10.10.0/24</ip-netmask>
            </entry>
            <entry name="MGT-Network">
              <ip-netmask>172.31.255.0/25</ip-netmask>
            </entry>
            <entry name="Cloud-Panorama">
              <fqdn>panorama.mgmt.example.com</fqdn>
            </entry>
            <entry name="ldap.idp.example.com">
              <fqdn>ldap.idp.example.com</fqdn>
            </entry>
            <entry name="ldap-mfa.idp.example.com">
              <fqdn>ldap-mfa.idp.example.com</fqdn>
            </entry>
            <entry name="Server-Alpha">
              <ip-netmask>192.168.0.4/32</ip-netmask>
            </entry>
            <entry name="Server-Beta">
              <ip-netmask>192.168.0.5/32</ip-netmask>
            </entry>
            <entry name="Server-Gamma">
              <ip-netmask>192.168.0.7/32</ip-netmask>
            </entry>
            <entry name="Server-Delta">
              <ip-netmask>192.168.0.8/32</ip-netmask>
            </entry>
            <entry name="Server-Epsilon">
              <ip-netmask>192.168.0.9/32</ip-netmask>
            </entry>
            <entry name="Server-Zeta">
              <ip-netmask>192.168.0.13/32</ip-netmask>
            </entry>
            <entry name="Server-Eta">
              <ip-netmask>192.168.0.14/32</ip-netmask>
            </entry>
            <entry name="Server-Theta">
              <ip-netmask>192.168.0.15/32</ip-netmask>
            </entry>
            <entry name="Server-Iota">
              <ip-netmask>192.168.0.17/32</ip-netmask>
            </entry>
            <entry name="Server-Kappa">
              <ip-netmask>192.168.0.141/32</ip-netmask>
            </entry>
            <entry name="AC-Server-GW">
              <ip-netmask>192.168.0.1/24</ip-netmask>
            </entry>
            <entry name="AC-Server-Network">
              <ip-netmask>192.168.0.0/24</ip-netmask>
            </entry>
            <entry name="BackupCloud-IP-203.0.113.0">
              <ip-netmask>203.0.113.0/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-203.0.113.64">
              <ip-netmask>203.0.113.64/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-203.0.113.128">
              <ip-netmask>203.0.113.128/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-203.0.113.192">
              <ip-netmask>203.0.113.192/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-192.0.2.0">
              <ip-netmask>192.0.2.0/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-192.0.2.64">
              <ip-netmask>192.0.2.64/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-192.0.2.128">
              <ip-netmask>192.0.2.128/25</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="BackupCloud-IP-192.0.2.192">
              <ip-netmask>192.0.2.192/26</ip-netmask>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="NAS-Cloud-AWS">
              <ip-netmask>203.0.113.10/32</ip-netmask>
            </entry>
            <entry name="NAS-Cloud-EU">
              <ip-netmask>203.0.113.11/32</ip-netmask>
            </entry>
            <entry name="Web-App-Public">
              <ip-netmask>198.51.100.10/27</ip-netmask>
            </entry>
            <entry name="Web-App-Public-Host">
              <ip-netmask>198.51.100.10/32</ip-netmask>
            </entry>
          </address>
          <profile-group>
            <entry name="Internet">
              <virus><member>default</member></virus>
              <spyware><member>default</member></spyware>
              <vulnerability><member>default</member></vulnerability>
              <url-filtering><member>default</member></url-filtering>
              <file-blocking><member>basic file blocking</member></file-blocking>
              <wildfire-analysis><member>default</member></wildfire-analysis>
            </entry>
            <entry name="Acme-Security-Profile">
              <virus><member>default</member></virus>
              <spyware><member>strict-1</member></spyware>
              <vulnerability><member>strict</member></vulnerability>
              <url-filtering><member>default-1</member></url-filtering>
              <file-blocking><member>basic file blocking</member></file-blocking>
              <wildfire-analysis><member>default</member></wildfire-analysis>
            </entry>
            <entry name="Acme-Security-Internal">
              <virus><member>default</member></virus>
              <spyware><member>strict</member></spyware>
              <vulnerability><member>strict</member></vulnerability>
              <url-filtering><member>default</member></url-filtering>
              <file-blocking><member>AC-basic file blocking</member></file-blocking>
              <wildfire-analysis><member>default</member></wildfire-analysis>
            </entry>
          </profile-group>
          <address-group>
            <entry name="AC-Servers">
              <static>
                <member>Server-Iota</member>
                <member>Server-Gamma</member>
                <member>Server-Epsilon</member>
                <member>Server-Zeta</member>
                <member>Server-Kappa</member>
                <member>Server-Alpha</member>
                <member>Server-Eta</member>
                <member>Server-Beta</member>
                <member>Server-Theta</member>
                <member>Server-Delta</member>
              </static>
            </entry>
            <entry name="BackupCloud IP Addresses">
              <static>
                <member>BackupCloud-IP-203.0.113.0</member>
                <member>BackupCloud-IP-203.0.113.64</member>
                <member>BackupCloud-IP-203.0.113.128</member>
                <member>BackupCloud-IP-203.0.113.192</member>
                <member>BackupCloud-IP-192.0.2.0</member>
                <member>BackupCloud-IP-192.0.2.64</member>
                <member>BackupCloud-IP-192.0.2.128</member>
                <member>BackupCloud-IP-192.0.2.192</member>
              </static>
              <description>Backup Cloud IP addresses</description>
            </entry>
            <entry name="NAS-Cloud-Servers">
              <static>
                <member>NAS-Cloud-AWS</member>
                <member>NAS-Cloud-EU</member>
              </static>
            </entry>
          </address-group>
          <profiles>
            <custom-url-category>
              <entry name="NAS-Cloud-Domains">
                <list>
                  <member>*.box.com/</member>
                  <member>*.app.box.com/</member>
                  <member>*.ent.box.com/</member>
                  <member>*.box.net/</member>
                  <member>*.boxcdn.net/</member>
                  <member>*.boxcloud.com/</member>
                </list>
                <type>URL List</type>
                <description>NAS Cloud Domains used for Cloud Services</description>
              </entry>
              <entry name="CloudStorage">
                <list>
                  <member>*.cloudstorage.example.com/</member>
                </list>
                <type>URL List</type>
              </entry>
            </custom-url-category>
            <file-blocking>
              <entry name="AC-basic file blocking">
                <rules>
                  <entry name="Block high risk file types">
                    <application><member>any</member></application>
                    <file-type>
                      <member>bat</member>
                      <member>chm</member>
                      <member>class</member>
                      <member>cpl</member>
                      <member>hlp</member>
                      <member>hta</member>
                      <member>ocx</member>
                      <member>PE</member>
                      <member>pif</member>
                      <member>rar</member>
                      <member>scr</member>
                      <member>torrent</member>
                      <member>vbe</member>
                      <member>wsf</member>
                    </file-type>
                    <direction>both</direction>
                    <action>block</action>
                  </entry>
                  <entry name="Continue prompt encrypted files">
                    <application><member>any</member></application>
                    <file-type>
                      <member>7z</member>
                      <member>dll</member>
                      <member>encrypted-7z</member>
                      <member>encrypted-rar</member>
                      <member>encrypted-zip</member>
                      <member>exe</member>
                      <member>jar</member>
                    </file-type>
                    <direction>both</direction>
                    <action>continue</action>
                  </entry>
                  <entry name="Log all other file types">
                    <application><member>any</member></application>
                    <file-type><member>any</member></file-type>
                    <direction>both</direction>
                    <action>alert</action>
                  </entry>
                </rules>
              </entry>
            </file-blocking>
            <url-filtering>
              <entry name="default-1">
                <credential-enforcement>
                  <mode><disabled/></mode>
                  <log-severity>medium</log-severity>
                </credential-enforcement>
                <alert>
                  <member>artificial-intelligence</member>
                  <member>cryptocurrency</member>
                  <member>high-risk</member>
                  <member>medium-risk</member>
                  <member>newly-registered-domain</member>
                  <member>real-time-detection</member>
                </alert>
                <block>
                  <member>abused-drugs</member>
                  <member>adult</member>
                  <member>command-and-control</member>
                  <member>gambling</member>
                  <member>hacking</member>
                  <member>malware</member>
                  <member>phishing</member>
                  <member>ransomware</member>
                  <member>weapons</member>
                </block>
              </entry>
            </url-filtering>
            <spyware>
              <entry name="strict-1">
                <rules>
                  <entry name="simple-critical">
                    <action><reset-both/></action>
                    <severity><member>critical</member></severity>
                    <threat-name>any</threat-name>
                    <category>any</category>
                    <packet-capture>disable</packet-capture>
                  </entry>
                  <entry name="simple-high">
                    <action><reset-both/></action>
                    <severity><member>high</member></severity>
                    <threat-name>any</threat-name>
                    <category>any</category>
                    <packet-capture>disable</packet-capture>
                  </entry>
                  <entry name="simple-medium">
                    <action><reset-both/></action>
                    <severity><member>medium</member></severity>
                    <threat-name>any</threat-name>
                    <category>any</category>
                    <packet-capture>disable</packet-capture>
                  </entry>
                  <entry name="simple-informational">
                    <action><default/></action>
                    <severity><member>informational</member></severity>
                    <threat-name>any</threat-name>
                    <category>any</category>
                    <packet-capture>disable</packet-capture>
                  </entry>
                  <entry name="simple-low">
                    <action><alert/></action>
                    <severity><member>low</member></severity>
                    <threat-name>any</threat-name>
                    <category>any</category>
                    <packet-capture>disable</packet-capture>
                  </entry>
                </rules>
                <botnet-domains>
                  <lists>
                    <entry name="default-paloalto-dns">
                      <action><sinkhole/></action>
                      <packet-capture>disable</packet-capture>
                    </entry>
                  </lists>
                  <sinkhole>
                    <ipv4-address>pan-sinkhole-default-ip</ipv4-address>
                    <ipv6-address>::1</ipv6-address>
                  </sinkhole>
                </botnet-domains>
              </entry>
            </spyware>
          </profiles>
          <external-list>
            <entry name="panw-bulletproof-ip-list">
              <type><predefined-ip><url>panw-bulletproof-ip-list</url></predefined-ip></type>
            </entry>
            <entry name="panw-highrisk-ip-list">
              <type><predefined-ip><url>panw-highrisk-ip-list</url></predefined-ip></type>
            </entry>
            <entry name="panw-known-ip-list">
              <type><predefined-ip><url>panw-known-ip-list</url></predefined-ip></type>
            </entry>
            <entry name="panw-torexit-ip-list">
              <type><predefined-ip><url>panw-torexit-ip-list</url></predefined-ip></type>
            </entry>
          </external-list>
        </entry>
      </vsys>
      <network>
        <virtual-router>
          <entry name="default">
            <interface>
              <member>ethernet1/1</member>
              <member>ethernet1/2</member>
              <member>ethernet1/3</member>
              <member>ethernet1/4</member>
            <member>ethernet1/5</member>
          </interface>
          <routing-table>
            <ip>
              <static-route>
                <entry name="default-route">
                  <destination>0.0.0.0/0</destination>
                  <nexthop>
                    <ip-address>203.0.113.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/1</interface>
                  <metric>10</metric>
                </entry>
                <entry name="corp-network">
                  <destination>10.0.0.0/8</destination>
                  <nexthop>
                    <ip-address>10.1.0.1</ip-address>
                  </nexthop>
                  <interface>ethernet1/2</interface>
                  <metric>10</metric>
                </entry>
                <entry name="branch-vpn">
                  <destination>172.16.0.0/12</destination>
                  <nexthop>
                    <ip-address>10.1.0.5</ip-address>
                  </nexthop>
                  <interface>ethernet1/3</interface>
                  <metric>20</metric>
                </entry>
              </static-route>
            </ip>
          </routing-table>
        </entry>
        </virtual-router>
      </network>
    </entry>
  </devices>
</config>`,
  },

  // =========================================================================
  // SAMPLE 6: SRX Set Commands (Junos)
  // =========================================================================
  srx_basic: {
    vendor: 'srx',
    label: 'SRX Basic (6 rules)',
    description: 'SRX set commands: 3 zones, address objects, 6 security policies, source NAT',
    xml: `set version 21.4R3-S5.4
set system host-name srx550-branch01

set chassis cluster cluster-id 1
set chassis cluster redundancy-group 0 node 0 priority 200
set chassis cluster redundancy-group 0 node 1 priority 100
set chassis cluster redundancy-group 1 node 0 priority 200
set chassis cluster redundancy-group 1 node 1 priority 100
set interfaces fab0 fabric-options member-interfaces ge-0/0/5
set interfaces fab1 fabric-options member-interfaces ge-5/0/5

set interfaces ge-0/0/0 unit 0 family inet address 10.1.1.1/24
set interfaces ge-0/0/0 unit 0 family inet6 address 2001:db8:1::1/64
set interfaces ge-0/0/0 unit 0 description "Trust LAN"
set interfaces ge-0/0/1 unit 0 family inet address 10.1.2.1/24
set interfaces ge-0/0/1 unit 0 family inet6 address 2001:db8:2::1/64
set interfaces ge-0/0/1 unit 0 description "Trust Server VLAN"
set interfaces ge-0/0/2 unit 0 family inet address 203.0.113.1/30
set interfaces ge-0/0/2 unit 0 family inet6 address 2001:db8:ffff::1/126
set interfaces ge-0/0/2 unit 0 description "Untrust WAN uplink"
set interfaces ge-0/0/3 unit 0 family inet address 172.16.10.1/24
set interfaces ge-0/0/3 unit 0 family inet6 address 2001:db8:a::1/64
set interfaces ge-0/0/3 unit 0 description "DMZ segment"
set interfaces lo0 unit 0 family inet address 10.255.0.1/32
set interfaces lo0 unit 0 family inet6 address 2001:db8::1/128
set interfaces st0 unit 0 family inet address 10.10.10.1/30

set security zones security-zone trust interfaces ge-0/0/0.0
set security zones security-zone trust interfaces ge-0/0/1.0
set security zones security-zone untrust interfaces ge-0/0/2.0
set security zones security-zone untrust screen untrust-screen
set security zones security-zone dmz interfaces ge-0/0/3.0

set security screen ids-option untrust-screen icmp ping-death
set security screen ids-option untrust-screen tcp syn-flood alarm-threshold 1024
set security screen ids-option untrust-screen tcp syn-flood attack-threshold 200
set security screen ids-option untrust-screen tcp syn-flood timeout 20
set security screen ids-option untrust-screen tcp land
set security screen ids-option untrust-screen ip spoofing
set security screen ids-option untrust-screen ip source-route-option
set security screen ids-option untrust-screen limit-session source-ip-based 100

set security ike proposal ike-branch-prop authentication-method pre-shared-keys
set security ike proposal ike-branch-prop dh-group group14
set security ike proposal ike-branch-prop encryption-algorithm aes-256-cbc
set security ike proposal ike-branch-prop authentication-algorithm sha-256
set security ike proposal ike-branch-prop lifetime-seconds 28800
set security ike policy ike-branch-pol proposals ike-branch-prop
set security ike policy ike-branch-pol pre-shared-key ascii-text "SANITIZED"
set security ike gateway gw-branch address 203.0.113.50
set security ike gateway gw-branch ike-policy ike-branch-pol
set security ike gateway gw-branch external-interface ge-0/0/2.0
set security ipsec proposal ipsec-branch-prop protocol esp
set security ipsec proposal ipsec-branch-prop encryption-algorithm aes-256-cbc
set security ipsec proposal ipsec-branch-prop authentication-algorithm hmac-sha-256-128
set security ipsec proposal ipsec-branch-prop lifetime-seconds 3600
set security ipsec policy ipsec-branch-pol perfect-forward-secrecy keys group14
set security ipsec policy ipsec-branch-pol proposals ipsec-branch-prop
set security ipsec vpn vpn-branch ike gateway gw-branch
set security ipsec vpn vpn-branch ike ipsec-policy ipsec-branch-pol
set security ipsec vpn vpn-branch bind-interface st0.0
set security ipsec vpn vpn-branch traffic-selector ts1 local-ip 192.168.0.0/16
set security ipsec vpn vpn-branch traffic-selector ts1 remote-ip 10.0.0.0/8

set security address-book global address web-server-1 10.10.10.10/32
set security address-book global address web-server-2 10.10.10.11/32
set security address-book global address app-server-1 10.20.20.10/32
set security address-book global address db-server-1 10.30.30.10/32
set security address-book global address dns-server 10.1.1.53/32
set security address-book global address internal-net 192.168.0.0/16
set security address-book global address dmz-net 10.10.10.0/24
set security address-book global address-set web-servers address web-server-1
set security address-book global address-set web-servers address web-server-2
set security address-book global address-set all-servers address web-server-1
set security address-book global address-set all-servers address web-server-2
set security address-book global address-set all-servers address app-server-1
set security address-book global address-set all-servers address db-server-1

set security policies from-zone trust to-zone untrust policy allow-internet match source-address any
set security policies from-zone trust to-zone untrust policy allow-internet match destination-address any
set security policies from-zone trust to-zone untrust policy allow-internet match application junos-http
set security policies from-zone trust to-zone untrust policy allow-internet match application junos-https
set security policies from-zone trust to-zone untrust policy allow-internet match application junos-dns-udp
set security policies from-zone trust to-zone untrust policy allow-internet then permit
set security policies from-zone trust to-zone untrust policy allow-internet then log session-close

set security policies from-zone untrust to-zone dmz policy allow-web match source-address any
set security policies from-zone untrust to-zone dmz policy allow-web match destination-address web-servers
set security policies from-zone untrust to-zone dmz policy allow-web match application junos-http
set security policies from-zone untrust to-zone dmz policy allow-web match application junos-https
set security policies from-zone untrust to-zone dmz policy allow-web then permit
set security policies from-zone untrust to-zone dmz policy allow-web then log session-init
set security policies from-zone untrust to-zone dmz policy allow-web then log session-close

set security policies from-zone trust to-zone dmz policy trust-to-dmz match source-address internal-net
set security policies from-zone trust to-zone dmz policy trust-to-dmz match destination-address dmz-net
set security policies from-zone trust to-zone dmz policy trust-to-dmz match source-identity "IT-Ops"
set security policies from-zone trust to-zone dmz policy trust-to-dmz match application any
set security policies from-zone trust to-zone dmz policy trust-to-dmz then permit
set security policies from-zone trust to-zone dmz policy trust-to-dmz then log session-close
set security policies from-zone trust to-zone dmz policy trust-to-dmz scheduler-name weekday-business

set security policies from-zone dmz to-zone trust policy dmz-to-db match source-address app-server-1
set security policies from-zone dmz to-zone trust policy dmz-to-db match destination-address db-server-1
set security policies from-zone dmz to-zone trust policy dmz-to-db match application junos-mysql
set security policies from-zone dmz to-zone trust policy dmz-to-db then permit
set security policies from-zone dmz to-zone trust policy dmz-to-db then log session-close

set security policies from-zone trust to-zone untrust policy allow-dns match source-address any
set security policies from-zone trust to-zone untrust policy allow-dns match destination-address any
set security policies from-zone trust to-zone untrust policy allow-dns match application junos-dns-udp
set security policies from-zone trust to-zone untrust policy allow-dns then permit

set security policies from-zone untrust to-zone trust policy deny-all match source-address any
set security policies from-zone untrust to-zone trust policy deny-all match destination-address any
set security policies from-zone untrust to-zone trust policy deny-all match application any
set security policies from-zone untrust to-zone trust policy deny-all then deny
set security policies from-zone untrust to-zone trust policy deny-all then log session-close

set security nat source rule-set trust-to-untrust from zone trust
set security nat source rule-set trust-to-untrust to zone untrust
set security nat source rule-set trust-to-untrust rule source-nat-rule match source-address 0.0.0.0/0
set security nat source rule-set trust-to-untrust rule source-nat-rule then source-nat interface

set applications application custom-app-8080 protocol tcp
set applications application custom-app-8080 destination-port 8080

set schedulers scheduler weekday-business monday start-time 08:00:00 stop-time 18:00:00
set schedulers scheduler weekday-business tuesday start-time 08:00:00 stop-time 18:00:00
set schedulers scheduler weekday-business wednesday start-time 08:00:00 stop-time 18:00:00
set schedulers scheduler weekday-business thursday start-time 08:00:00 stop-time 18:00:00
set schedulers scheduler weekday-business friday start-time 08:00:00 stop-time 18:00:00

set routing-options static route 0.0.0.0/0 next-hop 203.0.113.1
set routing-options static route 10.0.0.0/8 next-hop 192.168.1.1
set routing-options static route 172.16.0.0/12 discard

set routing-instances MGMT-VRF instance-type virtual-router
set routing-instances MGMT-VRF interface ge-0/0/4.0
set routing-instances MGMT-VRF routing-options static route 0.0.0.0/0 next-hop 10.99.0.1

set routing-options autonomous-system 65001
set routing-options router-id 10.0.0.1
set protocols bgp group EBGP-UPSTREAM type external
set protocols bgp group EBGP-UPSTREAM neighbor 203.0.113.2 peer-as 65100
set protocols bgp group EBGP-UPSTREAM neighbor 203.0.113.2 description "ISP-Primary"
set protocols bgp group EBGP-UPSTREAM neighbor 203.0.113.3 peer-as 65200
set protocols bgp group EBGP-UPSTREAM neighbor 203.0.113.3 description "ISP-Secondary"
set protocols bgp group IBGP-CORE type internal
set protocols bgp group IBGP-CORE neighbor 10.0.0.2 description "Core-Router"
set protocols ospf area 0.0.0.0 interface ge-0/0/0.0
set protocols ospf area 0.0.0.0 interface ge-0/0/1.0 metric 10
set protocols ospf area 0.0.0.0 interface lo0.0 passive
set protocols ospf area 0.0.0.1 stub
set protocols ospf area 0.0.0.1 interface ge-0/0/2.0

set protocols ospf3 area 0.0.0.0 interface ge-0/0/0.0
set protocols ospf3 area 0.0.0.0 interface ge-0/0/1.0
set protocols ospf3 area 0.0.0.0 interface lo0.0 passive
set protocols ospf3 area 0.0.0.2 nssa
set protocols ospf3 area 0.0.0.2 interface ge-0/0/3.0

set protocols evpn encapsulation vxlan
set protocols evpn multicast-mode ingress-replication
set protocols evpn extended-vni-list 5001
set protocols evpn extended-vni-list 5002
set switch-options vtep-source-interface lo0.0
set switch-options route-distinguisher 10.0.0.1:1
set switch-options vrf-target target:65001:1
set vlans VLAN100 vlan-id 100
set vlans VLAN100 vxlan vni 5001
set vlans VLAN100 vxlan ingress-node-replication
set vlans VLAN200 vlan-id 200
set vlans VLAN200 vxlan vni 5002

set system syslog host 10.0.0.100 any any
set system syslog host 10.0.0.101 any any
set system syslog host 10.0.0.101 transport protocol tcp
set system syslog host 10.0.0.101 port 1514
set system syslog file messages any notice
set system syslog file messages authorization info

set forwarding-options helpers bootp interface ge-0/0/1.0 server 10.2.2.1
set forwarding-options helpers bootp interface ge-0/0/1.0 server 10.2.2.2
set access address-assignment pool lan-pool family inet network 10.10.10.0/24
set access address-assignment pool lan-pool family inet range r1 low 10.10.10.100
set access address-assignment pool lan-pool family inet range r1 high 10.10.10.200
set access address-assignment pool lan-pool family inet dhcp-attributes router 10.10.10.1
set access address-assignment pool lan-pool family inet dhcp-attributes name-server 8.8.8.8
set system services dhcp-local-server group lan-pool interface ge-0/0/1.0

set class-of-service schedulers voice-sched transmit-rate 1m
set class-of-service schedulers voice-sched priority strict-high
set class-of-service schedulers data-sched transmit-rate 10m
set class-of-service schedulers data-sched buffer-size percent 30
set class-of-service interfaces ge-0/0/0 scheduler-map branch-sched-map
set class-of-service interfaces ge-0/0/0 shaping-rate 100m`,
  },

  // =========================================================================
  // SAMPLE 7: FortiGate / FortiOS Configuration
  // =========================================================================
  fortigate_basic: {
    vendor: 'fortigate',
    label: 'FortiGate Basic (8 rules)',
    description: 'FortiGate config: 3 zones, multi-VDOM, address objects, 8 firewall policies, VIP, application-list, security profiles',
    xml: `config system global
    set hostname "FG-60F-Branch01"
    set timezone "US/Pacific"
end

config vdom
    edit "root"
    next
    edit "GUEST"
    next
end

config system ha
    set mode a-p
    set group-id 10
    set group-name "FG-Branch-HA"
    set priority 200
    set hbdev "port5" 50
    set override enable
    set monitor "wan1" "wan2"
end

config log syslogd setting
    set server "10.0.0.100"
    set port 514
    set facility local7
    set mode udp
end

config log syslogd2 setting
    set server "10.0.0.101"
    set port 1514
    set mode reliable
end

config system interface
    edit "wan1"
        set vdom "root"
        set ip 203.0.113.1 255.255.255.0
        set type physical
        set alias "WAN-Primary"
        config ipv6
            set ip6-address 2001:db8:ffff::1/126
        end
    next
    edit "wan2"
        set vdom "root"
        set ip 198.51.100.1 255.255.255.0
        set type physical
        set alias "WAN-Secondary"
    next
    edit "dmz"
        set vdom "root"
        set ip 172.16.10.1 255.255.255.0
        set type physical
        set alias "DMZ-Servers"
        config ipv6
            set ip6-address 2001:db8:a::1/64
        end
    next
    edit "internal1"
        set vdom "root"
        set ip 10.1.1.1 255.255.255.0
        set type physical
        set alias "LAN-Users"
        config ipv6
            set ip6-address 2001:db8:1::1/64
        end
    next
    edit "internal2"
        set vdom "root"
        set ip 10.1.2.1 255.255.255.0
        set type physical
        set alias "LAN-Servers"
    next
    edit "guest-wifi"
        set vdom "GUEST"
        set ip 10.1.100.1 255.255.255.0
        set type physical
        set alias "Guest-WiFi-SSID"
    next
end

config system zone
    edit "LAN"
        set interface "internal1" "internal2"
    next
    edit "WAN"
        set interface "wan1" "wan2"
    next
    edit "DMZ"
        set interface "dmz"
    next
end

config router static
    edit 1
        set dst 0.0.0.0 0.0.0.0
        set gateway 203.0.113.1
        set device "wan1"
        set comment "Default route via WAN1"
    next
    edit 2
        set dst 10.0.0.0 255.0.0.0
        set gateway 10.1.1.1
        set device "internal1"
        set distance 10
        set comment "Corporate network"
    next
    edit 3
        set dst 172.16.10.0 255.255.255.0
        set gateway 172.16.1.1
        set device "dmz"
        set distance 10
        set comment "DMZ server subnet"
    next
    edit 4
        set dst 192.168.100.0 255.255.255.0
        set blackhole enable
        set comment "Null route for bogon"
    next
end

config system dhcp server
    edit 1
        set interface "internal1"
        set default-gateway 10.1.1.1
        set netmask 255.255.255.0
        set dns-server1 8.8.8.8
        set dns-server2 8.8.4.4
        set lease-time 43200
        config ip-range
            edit 1
                set start-ip 10.1.1.100
                set end-ip 10.1.1.200
            next
        end
    next
end

config firewall shaping-profile
    edit "branch-qos"
        config shaping-entries
            edit 1
                set class-id 2
                set priority high
                set guaranteed-bandwidth-percentage 40
                set maximum-bandwidth-percentage 80
            next
            edit 2
                set class-id 3
                set priority medium
                set guaranteed-bandwidth-percentage 20
                set maximum-bandwidth-percentage 60
            next
        end
    next
end

config firewall DoS-policy
    edit 1
        set interface "wan1"
        set srcaddr "all"
        set dstaddr "all"
        set service "ALL"
        config anomaly
            edit "tcp_syn_flood"
                set status enable
                set threshold 2000
            next
            edit "udp_flood"
                set status enable
                set threshold 2000
            next
            edit "icmp_flood"
                set status enable
                set threshold 100
            next
        end
    next
end

config vpn ipsec phase1-interface
    edit "Branch-VPN"
        set interface "wan1"
        set ike-version 2
        set proposal aes256-sha256
        set remote-gw 203.0.113.50
        set psksecret SANITIZED
    next
end
config vpn ipsec phase2-interface
    edit "Branch-VPN-P2"
        set phase1name "Branch-VPN"
        set proposal aes256-sha256
        set pfs enable
        set dhgrp 14
        set src-subnet 10.1.0.0 255.255.0.0
        set dst-subnet 192.168.0.0 255.255.0.0
    next
end

config firewall address
    edit "WebServer1"
        set type ipmask
        set subnet 172.16.10.10 255.255.255.255
        set comment "Primary web server"
    next
    edit "WebServer2"
        set type ipmask
        set subnet 172.16.10.11 255.255.255.255
        set comment "Secondary web server"
    next
    edit "DBServer"
        set type ipmask
        set subnet 10.1.2.50 255.255.255.255
        set comment "PostgreSQL database"
    next
    edit "LAN-Subnet"
        set type ipmask
        set subnet 10.1.0.0 255.255.0.0
        set comment "All LAN networks"
    next
    edit "MailServer"
        set type ipmask
        set subnet 172.16.10.20 255.255.255.255
        set comment "Exchange mail server"
    next
    edit "DNS-Servers"
        set type ipmask
        set subnet 10.1.2.53 255.255.255.255
        set comment "Internal DNS"
    next
    edit "Guest-WiFi"
        set type ipmask
        set subnet 10.1.100.0 255.255.255.0
        set comment "Guest wireless network"
    next
    edit "VPN-Pool"
        set type iprange
        set start-ip 10.10.10.1
        set end-ip 10.10.10.254
        set comment "SSL VPN address pool"
    next
end

config firewall addrgrp
    edit "DMZ-Servers"
        set member "WebServer1" "WebServer2" "MailServer"
        set comment "All DMZ servers"
    next
    edit "Internal-Servers"
        set member "DBServer" "DNS-Servers"
        set comment "Internal server group"
    next
end

config firewall service custom
    edit "Web-Services"
        set protocol TCP/UDP/SCTP
        set tcp-portrange 80 443 8080 8443
        set comment "HTTP and HTTPS variants"
    next
    edit "DB-Access"
        set protocol TCP/UDP/SCTP
        set tcp-portrange 5432 3306
        set comment "PostgreSQL and MySQL"
    next
end

config firewall service group
    edit "Internet-Services"
        set member "HTTP" "HTTPS" "DNS"
    next
end

config firewall vip
    edit "WebServer1-VIP"
        set type static-nat
        set extip 203.0.113.10
        set mappedip "172.16.10.10"
        set extintf "wan1"
        set portforward enable
        set extport 443
        set mappedport 443
        set comment "HTTPS to WebServer1"
    next
    edit "MailServer-VIP"
        set type static-nat
        set extip 203.0.113.20
        set mappedip "172.16.10.20"
        set extintf "wan1"
        set portforward enable
        set extport 25
        set mappedport 25
        set comment "SMTP to mail server"
    next
end

config firewall schedule recurring
    edit "office-hours"
        set day monday tuesday wednesday thursday friday
        set start 08:00
        set end 18:00
    next
end

config application list
    edit "branch-app-ctrl"
        set comment "Branch office application control"
        config entries
            edit 1
                set application 15832 15835
                set action pass
            next
            edit 2
                set category 2
                set action block
            next
        end
    next
end

config firewall policy
    edit 1
        set name "LAN-to-Internet"
        set uuid 11111111-1111-1111-1111-111111111111
        set srcintf "LAN"
        set dstintf "WAN"
        set action accept
        set srcaddr "LAN-Subnet"
        set dstaddr "all"
        set groups "IT_Staff"
        set schedule "always"
        set service "ALL"
        set utm-status enable
        set av-profile "default"
        set webfilter-profile "default"
        set ips-sensor "default"
        set application-list "branch-app-ctrl"
        set ssl-ssh-profile "certificate-inspection"
        set logtraffic all
        set nat enable
        set comments "Allow LAN users to internet with full UTM"
    next
    edit 2
        set name "DMZ-to-Internet"
        set uuid 22222222-2222-2222-2222-222222222222
        set srcintf "DMZ"
        set dstintf "WAN"
        set action accept
        set srcaddr "DMZ-Servers"
        set dstaddr "all"
        set schedule "always"
        set service "Internet-Services"
        set utm-status enable
        set av-profile "default"
        set ips-sensor "default"
        set logtraffic all
        set nat enable
        set comments "DMZ servers to internet for updates"
    next
    edit 3
        set name "Inbound-HTTPS"
        set uuid 33333333-3333-3333-3333-333333333333
        set srcintf "WAN"
        set dstintf "DMZ"
        set action accept
        set srcaddr "all"
        set dstaddr "WebServer1-VIP"
        set schedule "always"
        set service "HTTPS"
        set utm-status enable
        set av-profile "default"
        set ips-sensor "default"
        set ssl-ssh-profile "deep-inspection"
        set logtraffic all
        set comments "Inbound HTTPS to web server via VIP"
    next
    edit 4
        set name "Inbound-SMTP"
        set uuid 44444444-4444-4444-4444-444444444444
        set srcintf "WAN"
        set dstintf "DMZ"
        set action accept
        set srcaddr "all"
        set dstaddr "MailServer-VIP"
        set schedule "always"
        set service "SMTP"
        set utm-status enable
        set av-profile "default"
        set ips-sensor "default"
        set logtraffic all
        set comments "Inbound SMTP to mail server"
    next
    edit 5
        set name "LAN-to-DMZ"
        set uuid 55555555-5555-5555-5555-555555555555
        set srcintf "LAN"
        set dstintf "DMZ"
        set action accept
        set srcaddr "LAN-Subnet"
        set dstaddr "DMZ-Servers"
        set schedule "office-hours"
        set service "Web-Services"
        set logtraffic all
        set comments "LAN access to DMZ servers"
    next
    edit 6
        set name "DMZ-to-DB"
        set uuid 66666666-6666-6666-6666-666666666666
        set srcintf "DMZ"
        set dstintf "LAN"
        set action accept
        set srcaddr "WebServer1" "WebServer2"
        set dstaddr "DBServer"
        set schedule "always"
        set service "DB-Access"
        set utm-status enable
        set ips-sensor "default"
        set logtraffic all
        set comments "Web servers to database"
    next
    edit 7
        set name "Guest-Internet-Only"
        set uuid 77777777-7777-7777-7777-777777777777
        set srcintf "LAN"
        set dstintf "WAN"
        set action accept
        set srcaddr "Guest-WiFi"
        set dstaddr "all"
        set schedule "always"
        set service "Internet-Services"
        set utm-status enable
        set webfilter-profile "default"
        set logtraffic all
        set nat enable
        set comments "Guest WiFi internet only — no internal access"
    next
    edit 8
        set name "Deny-All"
        set uuid 88888888-8888-8888-8888-888888888888
        set srcintf "any"
        set dstintf "any"
        set action deny
        set srcaddr "all"
        set dstaddr "all"
        set schedule "always"
        set service "ALL"
        set logtraffic all
        set comments "Implicit deny-all cleanup rule"
    next
end

config router bgp
    set as 65020
    set router-id 10.1.1.1
    config neighbor
        edit "203.0.113.2"
            set remote-as 65100
            set description "ISP-Primary"
            set update-source "wan1"
        next
        edit "10.1.1.2"
            set remote-as 65020
            set description "Core-Switch"
        next
    end
    config network
        edit 1
            set prefix 10.1.0.0 255.255.0.0
        next
    end
    config redistribute "static"
        set status enable
    next
end

config router ospf
    set router-id 10.1.1.1
    config area
        edit 0.0.0.0
        next
        edit 0.0.0.1
            set type stub
        next
    end
    config ospf-interface
        edit "internal1-ospf"
            set interface "internal1"
            set area 0.0.0.0
            set cost 10
            set hello-interval 10
            set dead-interval 40
        next
        edit "internal2-ospf"
            set interface "internal2"
            set area 0.0.0.1
            set cost 20
        next
        edit "lo-ospf"
            set interface "loopback0"
            set area 0.0.0.0
        next
    end
    config passive-interface
        edit "loopback0"
            set name "loopback0"
        next
    end
    config redistribute "static"
        set status enable
    next
end

config router ospf6
    set router-id 10.1.1.1
    config area
        edit 0.0.0.0
        next
        edit 0.0.0.2
            set type nssa
        next
    end
    config ospf6-interface
        edit "internal1-ospf6"
            set interface "internal1"
            set area-id 0.0.0.0
        next
        edit "internal2-ospf6"
            set interface "internal2"
            set area-id 0.0.0.2
            set cost 15
        next
    end
end

config system vxlan
    edit "vxlan1"
        set vni 5001
        set interface "port1"
        set dstport 4789
        config remote-ip
            edit 1
                set ip 10.10.10.2
            next
            edit 2
                set ip 10.10.10.3
            next
        end
    next
end`,
  },

  // =========================================================================
  // SAMPLE: Cisco ASA Basic
  // =========================================================================
  cisco_basic: {
    vendor: 'cisco_asa',
    label: 'Basic (8 rules)',
    description: 'Cisco ASA: 3 zones, multi-context, object networks, object-groups, 8 ACL rules, NAT',
    xml: `ASA Version 9.16
!
hostname FW-EDGE-01
!
mode multiple
admin-context admin
!
context admin
 allocate-interface GigabitEthernet1/1
 allocate-interface GigabitEthernet1/2
 allocate-interface GigabitEthernet1/3
 config-url disk0:/admin.cfg
!
context DMZ-CTX
 allocate-interface GigabitEthernet1/4
 config-url disk0:/dmz.cfg
!
failover
failover lan unit primary
failover lan interface FAILOVER GigabitEthernet0/6
failover link STATEFUL GigabitEthernet0/7
failover interface ip FAILOVER 10.0.99.1 255.255.255.252 standby 10.0.99.2
failover interface ip STATEFUL 10.0.99.5 255.255.255.252 standby 10.0.99.6
!
interface GigabitEthernet1/1
 nameif inside
 security-level 100
 ip address 10.1.1.1 255.255.255.0
 ipv6 address 2001:db8:1::1/64
!
interface GigabitEthernet1/2
 nameif outside
 security-level 0
 ip address 203.0.113.1 255.255.255.252
 ipv6 address 2001:db8:ffff::1/126
!
interface GigabitEthernet1/3
 nameif dmz
 security-level 50
 ip address 172.16.1.1 255.255.255.0
 ipv6 address 2001:db8:a::1/64
!
object network web-server
 host 172.16.1.10
 description Primary web server in DMZ
object network mail-server
 host 172.16.1.20
 description Exchange mail server
object network internal-net
 subnet 10.1.0.0 255.255.0.0
 description Internal corporate network
object network db-server
 host 10.1.2.50
 description PostgreSQL database server
object network dns-server
 host 10.1.1.53
 description Internal DNS resolver
object network guest-net
 subnet 10.99.0.0 255.255.255.0
 description Guest WiFi network
!
object-group network DMZ-SERVERS
 network-object object web-server
 network-object object mail-server
object-group network INTERNAL-ALL
 network-object object internal-net
 network-object object guest-net
!
object-group service WEB-SERVICES tcp
 port-object eq www
 port-object eq https
object-group service MAIL-SERVICES tcp
 port-object eq smtp
 port-object eq 993
 port-object eq 587
object-group service MGMT-SERVICES tcp
 port-object eq ssh
 port-object eq 3389
!
time-range BUSINESS-HOURS
 periodic weekdays 08:00 to 18:00
!
access-list outside_access_in extended remark Allow inbound web traffic to DMZ
access-list outside_access_in extended permit tcp any object web-server object-group WEB-SERVICES log
access-list outside_access_in extended remark Allow inbound mail
access-list outside_access_in extended permit tcp any object mail-server object-group MAIL-SERVICES log
access-list outside_access_in extended remark Deny all other inbound
access-list outside_access_in extended deny ip any any log
!
access-list inside_access_in extended remark Allow internal to internet
access-list inside_access_in extended permit tcp user CORP\\employees object internal-net any object-group WEB-SERVICES
access-list inside_access_in extended remark Allow DNS
access-list inside_access_in extended permit udp object internal-net any eq domain
access-list inside_access_in extended remark Allow internal to DMZ servers
access-list inside_access_in extended permit tcp object internal-net object-group DMZ-SERVERS object-group WEB-SERVICES
access-list inside_access_in extended remark Allow MGMT to servers (business hours only)
access-list inside_access_in extended permit tcp 10.1.1.0 255.255.255.0 object-group DMZ-SERVERS object-group MGMT-SERVICES time-range BUSINESS-HOURS
access-list inside_access_in extended remark Deny all other internal
access-list inside_access_in extended deny ip any any log
!
access-group outside_access_in in interface outside
access-group inside_access_in in interface inside
!
crypto ikev2 policy 10
 encryption aes-256
 integrity sha256
 group 14
 lifetime 28800
!
crypto ipsec ikev2 ipsec-proposal BRANCH-PROPOSAL
 protocol esp encryption aes-256
 protocol esp integrity sha-256
!
crypto map OUTSIDE_MAP 10 set peer 203.0.113.50
crypto map OUTSIDE_MAP 10 set ikev2 ipsec-proposal BRANCH-PROPOSAL
crypto map OUTSIDE_MAP 10 set pfs group14
crypto map OUTSIDE_MAP interface outside
!
tunnel-group 203.0.113.50 type ipsec-l2l
!
route outside 0.0.0.0 0.0.0.0 203.0.113.254 1
route inside 10.0.0.0 255.0.0.0 10.1.1.254 10
route dmz 172.16.10.0 255.255.255.0 172.16.10.254 1
!
threat-detection basic-threat
threat-detection rate syn-attack rate-interval 600 average-rate 100 burst-rate 200
threat-detection rate dos-drop rate-interval 600 average-rate 50 burst-rate 100
threat-detection statistics access-list
!
logging host inside 10.0.0.100
logging host inside 10.0.0.101 6/1514
logging trap informational
logging facility 20
!
dhcpd address 10.1.1.100-10.1.1.200 inside
dhcpd dns 8.8.8.8 8.8.4.4
dhcpd enable inside
!
dhcprelay server 10.2.2.1 outside
dhcprelay server 10.2.2.2 outside
!
policy-map global_policy
 class inspection_default
  police output 1000000 125000
  priority
!
service-policy global_policy global
!
object network internal-net
 nat (inside,outside) dynamic interface
object network web-server
 nat (dmz,outside) static 203.0.113.10
object network mail-server
 nat (dmz,outside) static 203.0.113.20
!
router bgp 65030
 bgp router-id 10.1.1.1
 neighbor 203.0.113.2 remote-as 65100
 neighbor 203.0.113.2 description ISP-Primary
 neighbor 203.0.113.2 activate
 neighbor 10.1.1.2 remote-as 65030
 neighbor 10.1.1.2 description Core-Switch
 neighbor 10.1.1.2 activate
 network 10.1.0.0 mask 255.255.0.0
 redistribute static
!
router ospf 1
 router-id 10.1.1.1
 network 10.1.1.0 0.0.0.255 area 0
 network 10.1.2.0 0.0.0.255 area 0
 network 172.16.1.0 0.0.0.255 area 1
 redistribute static subroutine
!
ipv6 router ospf 1
 router-id 10.1.1.1
 area 0 nssa
!
interface GigabitEthernet1/1
 ipv6 ospf 1 area 0
 ipv6 ospf cost 10
!
interface GigabitEthernet1/2
 ipv6 ospf 1 area 0
!
nve 1
 source-interface loopback0
 member vni 5001 mcast-group 239.1.1.1
 member vni 5002
!`,
  },

  // =========================================================================
  // SAMPLE: Check Point R81 Basic
  // =========================================================================
  checkpoint_basic: {
    vendor: 'checkpoint',
    label: 'Basic (6 rules)',
    description: 'Check Point R81: objects-dictionary + rulebase JSON, 3 zones, 6 rules, NAT, Gaia clish interfaces',
    xml: `{
  "objects-dictionary": [
    { "uid": "any-obj", "name": "Any", "type": "CpmiAnyObject" },
    { "uid": "act-accept", "name": "Accept", "type": "RulebaseAction" },
    { "uid": "act-drop", "name": "Drop", "type": "RulebaseAction" },
    { "uid": "track-log", "name": "Log", "type": "Track" },
    { "uid": "track-none", "name": "None", "type": "Track" },
    {
      "uid": "host-web01",
      "name": "Web-Server-01",
      "type": "host",
      "ipv4-address": "172.16.1.10"
    },
    {
      "uid": "host-mail01",
      "name": "Mail-Server-01",
      "type": "host",
      "ipv4-address": "172.16.1.20"
    },
    {
      "uid": "host-db01",
      "name": "DB-Server-01",
      "type": "host",
      "ipv4-address": "10.1.2.50"
    },
    {
      "uid": "net-internal",
      "name": "Internal-LAN",
      "type": "network",
      "ipv4-address": "10.1.0.0",
      "subnet-mask": "255.255.0.0"
    },
    {
      "uid": "net-dmz",
      "name": "DMZ-Subnet",
      "type": "network",
      "ipv4-address": "172.16.1.0",
      "subnet-mask": "255.255.255.0"
    },
    {
      "uid": "net-guest",
      "name": "Guest-WiFi",
      "type": "network",
      "ipv4-address": "10.99.0.0",
      "subnet-mask": "255.255.255.0"
    },
    {
      "uid": "grp-dmz-servers",
      "name": "DMZ-Servers",
      "type": "group",
      "members": ["host-web01", "host-mail01"]
    },
    {
      "uid": "svc-http",
      "name": "http",
      "type": "service-tcp",
      "port": "80"
    },
    {
      "uid": "svc-https",
      "name": "https",
      "type": "service-tcp",
      "port": "443"
    },
    {
      "uid": "svc-smtp",
      "name": "smtp",
      "type": "service-tcp",
      "port": "25"
    },
    {
      "uid": "svc-ssh",
      "name": "ssh",
      "type": "service-tcp",
      "port": "22"
    },
    {
      "uid": "svc-dns-udp",
      "name": "domain-udp",
      "type": "service-udp",
      "port": "53"
    },
    {
      "uid": "svc-icmp-echo",
      "name": "echo-request",
      "type": "service-icmp",
      "icmp-type": 8,
      "icmp-code": 0
    },
    {
      "uid": "svcgrp-web",
      "name": "Web-Services",
      "type": "service-group",
      "members": ["svc-http", "svc-https"]
    },
    {
      "uid": "svcgrp-mail",
      "name": "Mail-Services",
      "type": "service-group",
      "members": ["svc-smtp"]
    },
    {
      "uid": "role-it-admins",
      "name": "IT-Admins-Role",
      "type": "access-role",
      "users": "IT-Admins",
      "networks": "Any"
    },
    {
      "uid": "gw-main",
      "name": "CP-GW-01",
      "type": "simple-gateway",
      "ipv4-address": "203.0.113.1",
      "interfaces": [
        { "name": "eth0", "ipv4-address": "10.1.1.254", "ipv4-mask-length": 24,
          "topology": { "leads-to": { "name": "InternalZone" } } },
        { "name": "eth1", "ipv4-address": "203.0.113.1", "ipv4-mask-length": 30,
          "topology": { "leads-to": { "name": "ExternalZone" } } },
        { "name": "eth2", "ipv4-address": "172.16.1.1", "ipv4-mask-length": 24,
          "topology": { "leads-to": { "name": "DMZZone" } } }
      ]
    }
  ],
  "rulebase": [
    {
      "type": "access-section",
      "name": "Inbound Policy",
      "uid": "section-inbound",
      "rulebase": [
        {
          "type": "access-rule",
          "uid": "rule-1",
          "name": "Allow-Inbound-Web",
          "rule-number": 1,
          "enabled": true,
          "source": ["any-obj"],
          "destination": ["host-web01"],
          "service": ["svcgrp-web"],
          "action": { "uid": "act-accept" },
          "track": { "uid": "track-log" },
          "install-on": ["gw-main"],
          "comments": "Allow internet users to reach web server"
        },
        {
          "type": "access-rule",
          "uid": "rule-2",
          "name": "Allow-Inbound-Mail",
          "rule-number": 2,
          "enabled": true,
          "source": ["any-obj"],
          "destination": ["host-mail01"],
          "service": ["svcgrp-mail"],
          "action": { "uid": "act-accept" },
          "track": { "uid": "track-log" },
          "install-on": ["gw-main"],
          "comments": "Allow inbound SMTP to mail server"
        }
      ]
    },
    {
      "type": "access-section",
      "name": "Internal Policy",
      "uid": "section-internal",
      "rulebase": [
        {
          "type": "access-rule",
          "uid": "rule-3",
          "name": "Allow-Internal-Web",
          "rule-number": 3,
          "enabled": true,
          "source": ["net-internal"],
          "destination": ["any-obj"],
          "service": ["svcgrp-web", "svc-dns-udp"],
          "action": { "uid": "act-accept" },
          "track": { "uid": "track-log" },
          "comments": "Allow internal users web browsing and DNS"
        },
        {
          "type": "access-rule",
          "uid": "rule-4",
          "name": "Allow-Admin-SSH",
          "rule-number": 4,
          "enabled": true,
          "source": ["role-it-admins", "net-internal"],
          "destination": ["grp-dmz-servers"],
          "service": ["svc-ssh"],
          "action": { "uid": "act-accept" },
          "track": { "uid": "track-log" },
          "comments": "Allow IT admins SSH to DMZ servers"
        },
        {
          "type": "access-rule",
          "uid": "rule-5",
          "name": "Allow-Ping",
          "rule-number": 5,
          "enabled": true,
          "source": ["net-internal"],
          "destination": ["grp-dmz-servers"],
          "service": ["svc-icmp-echo"],
          "action": { "uid": "act-accept" },
          "track": { "uid": "track-none" },
          "comments": "Allow ICMP echo for monitoring"
        }
      ]
    },
    {
      "type": "access-rule",
      "uid": "rule-6",
      "name": "Cleanup-Rule",
      "rule-number": 6,
      "enabled": true,
      "source": ["any-obj"],
      "destination": ["any-obj"],
      "service": ["any-obj"],
      "action": { "uid": "act-drop" },
      "track": { "uid": "track-log" },
      "comments": "Default deny-all cleanup rule"
    }
  ],
  "nat-rulebase": {
    "rulebase": [
      {
        "type": "nat-rule",
        "uid": "nat-1",
        "name": "Hide-Internal",
        "enabled": true,
        "original-source": { "uid": "net-internal" },
        "original-destination": { "uid": "any-obj" },
        "original-service": { "uid": "any-obj" },
        "translated-source": { "uid": "gw-main" },
        "translated-destination": { "uid": "any-obj" },
        "translated-service": { "uid": "any-obj" },
        "method": "hide",
        "comments": "Hide NAT for internal network"
      },
      {
        "type": "nat-rule",
        "uid": "nat-2",
        "name": "Static-WebServer",
        "enabled": true,
        "original-source": { "uid": "any-obj" },
        "original-destination": { "uid": "host-web01" },
        "original-service": { "uid": "svcgrp-web" },
        "translated-source": { "uid": "any-obj" },
        "translated-destination": { "uid": "host-web01" },
        "translated-service": { "uid": "svcgrp-web" },
        "method": "static",
        "comments": "Static NAT for web server"
      }
    ]
  }
}

--- GAIA CLISH ---
set hostname CP-GW-01
add interface eth0
add interface eth1
add interface eth2
set interface eth0 ipv4-address 10.1.1.254 mask-length 24
set interface eth1 ipv4-address 203.0.113.1 mask-length 30
set interface eth2 ipv4-address 172.16.1.1 mask-length 24
set static-route 0.0.0.0/0 nexthop gateway address 203.0.113.2 on
set static-route 10.0.0.0/8 nexthop gateway address 10.1.1.1 on`,
  },

  // =========================================================================
  // SAMPLE: SonicWall TZ Basic
  // =========================================================================
  sonicwall_basic: {
    vendor: 'sonicwall',
    label: 'Basic (6 rules)',
    description: 'SonicWall TZ: REST API JSON, 3 zones, address/service objects, 6 access rules, source NAT',
    xml: `{
  "firmware_version": "7.0.1-5095",
  "zones": [
    { "name": "LAN", "security_type": "trusted", "uuid": "zone-lan-001" },
    { "name": "WAN", "security_type": "untrusted", "uuid": "zone-wan-001" },
    { "name": "DMZ", "security_type": "public", "uuid": "zone-dmz-001" }
  ],
  "interfaces": {
    "ipv4": [
      {
        "name": "X0",
        "zone": "LAN",
        "ip_assignment": { "mode": { "static": { "ip": "10.1.1.1", "netmask": "255.255.255.0" } } },
        "enabled": true,
        "description": "LAN interface"
      },
      {
        "name": "X1",
        "zone": "WAN",
        "ip_assignment": { "mode": { "static": { "ip": "203.0.113.1", "netmask": "255.255.255.252" } } },
        "enabled": true,
        "description": "WAN interface"
      },
      {
        "name": "X2",
        "zone": "DMZ",
        "ip_assignment": { "mode": { "static": { "ip": "172.16.1.1", "netmask": "255.255.255.0" } } },
        "enabled": true,
        "description": "DMZ interface"
      }
    ]
  },
  "address_objects": {
    "ipv4": [
      { "name": "LAN-Subnet", "network": { "ip": "10.1.1.0", "mask": "255.255.255.0" }, "description": "Internal LAN" },
      { "name": "Web-Server", "host": { "ip": "172.16.1.10" }, "description": "DMZ web server" },
      { "name": "Mail-Server", "host": { "ip": "172.16.1.20" }, "description": "DMZ mail server" },
      { "name": "DB-Server", "host": { "ip": "10.1.2.50" }, "description": "Internal database" },
      { "name": "DNS-Server", "host": { "ip": "10.1.1.53" }, "description": "Internal DNS resolver" },
      { "name": "Admin-PC", "host": { "ip": "10.1.1.100" }, "description": "IT admin workstation" }
    ],
    "fqdn": [
      { "name": "Updates-FQDN", "domain": "updates.vendor.com", "description": "Vendor update server" }
    ]
  },
  "address_groups": {
    "ipv4": [
      {
        "name": "DMZ-Servers",
        "address_object": { "ipv4": [{ "name": "Web-Server" }, { "name": "Mail-Server" }] },
        "description": "All DMZ servers"
      },
      {
        "name": "Critical-Servers",
        "address_object": { "ipv4": [{ "name": "DB-Server" }, { "name": "DNS-Server" }] },
        "address_group": { "ipv4": [{ "name": "DMZ-Servers" }] },
        "description": "All servers including DMZ"
      }
    ]
  },
  "service_objects": [
    { "name": "HTTP", "protocol": { "tcp": true }, "port_range": { "begin": 80, "end": 80 }, "description": "HTTP" },
    { "name": "HTTPS", "protocol": { "tcp": true }, "port_range": { "begin": 443, "end": 443 }, "description": "HTTPS" },
    { "name": "SMTP", "protocol": { "tcp": true }, "port_range": { "begin": 25, "end": 25 }, "description": "SMTP" },
    { "name": "SSH-Mgmt", "protocol": { "tcp": true }, "port_range": { "begin": 22, "end": 22 }, "description": "SSH" },
    { "name": "DNS-UDP", "protocol": { "udp": true }, "port_range": { "begin": 53, "end": 53 }, "description": "DNS" },
    { "name": "PGSQL", "protocol": { "tcp": true }, "port_range": { "begin": 5432, "end": 5432 }, "description": "PostgreSQL" }
  ],
  "service_groups": [
    { "name": "Web-Services", "service_object": [{ "name": "HTTP" }, { "name": "HTTPS" }], "description": "Web traffic" },
    { "name": "Mail-Services", "service_object": [{ "name": "SMTP" }], "description": "Mail protocols" }
  ],
  "access_rules": {
    "ipv4": [
      {
        "name": "Allow-LAN-Web",
        "uuid": "rule-001",
        "from": "LAN",
        "to": "WAN",
        "source": { "address": [{ "name": "LAN-Subnet" }], "group": "Domain-Users" },
        "destination": { "any": true },
        "service": [{ "name": "Web-Services" }],
        "action": "allow",
        "enabled": true,
        "logging": true,
        "dpi": true,
        "priority": { "manual": 1 },
        "comment": "Allow LAN users to browse web"
      },
      {
        "name": "Allow-LAN-DNS",
        "uuid": "rule-002",
        "from": "LAN",
        "to": "WAN",
        "source": { "address": [{ "name": "DNS-Server" }] },
        "destination": { "any": true },
        "service": [{ "name": "DNS-UDP" }],
        "action": "allow",
        "enabled": true,
        "logging": false,
        "priority": { "manual": 2 },
        "comment": "Allow DNS resolver to query external"
      },
      {
        "name": "Allow-Inbound-Web",
        "uuid": "rule-003",
        "from": "WAN",
        "to": "DMZ",
        "source": { "any": true },
        "destination": { "address": [{ "name": "Web-Server" }] },
        "service": [{ "name": "Web-Services" }],
        "action": "allow",
        "enabled": true,
        "logging": true,
        "dpi": true,
        "priority": { "manual": 1 },
        "comment": "Allow inbound HTTPS to web server"
      },
      {
        "name": "Allow-Inbound-Mail",
        "uuid": "rule-004",
        "from": "WAN",
        "to": "DMZ",
        "source": { "any": true },
        "destination": { "address": [{ "name": "Mail-Server" }] },
        "service": [{ "name": "Mail-Services" }],
        "action": "allow",
        "enabled": true,
        "logging": true,
        "priority": { "manual": 2 },
        "comment": "Allow inbound SMTP to mail server"
      },
      {
        "name": "Allow-Admin-SSH",
        "uuid": "rule-005",
        "from": "LAN",
        "to": "DMZ",
        "source": { "address": [{ "name": "Admin-PC" }] },
        "destination": { "address": [{ "name": "DMZ-Servers" }] },
        "service": [{ "name": "SSH-Mgmt" }],
        "action": "allow",
        "enabled": true,
        "logging": true,
        "priority": { "manual": 1 },
        "comment": "Allow admin SSH to DMZ servers"
      },
      {
        "name": "Deny-All-Default",
        "uuid": "rule-006",
        "from": "WAN",
        "to": "LAN",
        "source": { "any": true },
        "destination": { "any": true },
        "service": [{ "any": true }],
        "action": "deny",
        "enabled": true,
        "logging": true,
        "priority": { "manual": 99 },
        "comment": "Default deny all inbound traffic"
      }
    ]
  },
  "nat_policies": {
    "ipv4": [
      {
        "name": "LAN-Outbound-NAT",
        "uuid": "nat-001",
        "inbound": "LAN",
        "outbound": "WAN",
        "original_source": { "address": [{ "name": "LAN-Subnet" }] },
        "original_destination": { "any": true },
        "translated_source": { "name": "X1 IP" },
        "translated_destination": { "original": true },
        "enabled": true,
        "comment": "Source NAT for LAN to WAN"
      },
      {
        "name": "WebServer-DNAT",
        "uuid": "nat-002",
        "inbound": "WAN",
        "outbound": "DMZ",
        "original_source": { "any": true },
        "original_destination": { "address": [{ "name": "X1 IP" }] },
        "translated_source": { "original": true },
        "translated_destination": { "name": "Web-Server" },
        "enabled": true,
        "comment": "Destination NAT for web server"
      }
    ]
  },
  "route_policies": {
    "ipv4": [
      {
        "destination": { "name": "0.0.0.0" },
        "mask": { "name": "0.0.0.0" },
        "gateway": "203.0.113.2",
        "interface": "X1",
        "metric": 1,
        "comment": "Default route via WAN"
      }
    ]
  }
}`,
  },

  // =========================================================================
  // SAMPLE: Huawei USG Basic
  // =========================================================================
  huawei_basic: {
    vendor: 'huawei_usg',
    label: 'Basic (6 rules)',
    description: 'Huawei USG6000E: VRP CLI, 3 zones, address/service sets, 6 security rules, NAT, static routes',
    xml: `#
sysname USG6000E-HQ
#
hrp enable
hrp standby-device 10.1.1.253
#
interface GigabitEthernet0/0/0
 ip address 10.1.1.254 255.255.255.0
 description LAN-Interface
#
interface GigabitEthernet0/0/1
 ip address 203.0.113.1 255.255.255.252
 description WAN-Interface
#
interface GigabitEthernet0/0/2
 ip address 172.16.1.1 255.255.255.0
 description DMZ-Interface
#
firewall zone trust
 priority 85
 add interface GigabitEthernet0/0/0
#
firewall zone untrust
 priority 5
 add interface GigabitEthernet0/0/1
#
firewall zone dmz
 priority 50
 add interface GigabitEthernet0/0/2
#
ip address-set LAN-Subnet type object
 address 0 10.1.1.0 mask 255.255.255.0
#
ip address-set Web-Server type object
 address 0 172.16.1.10 mask 255.255.255.255
#
ip address-set Mail-Server type object
 address 0 172.16.1.20 mask 255.255.255.255
#
ip address-set DB-Server type object
 address 0 10.1.2.50 mask 255.255.255.255
#
ip address-set Admin-PC type object
 address 0 10.1.1.100 mask 255.255.255.255
#
ip address-set DMZ-Servers type group
 address address-set Web-Server
 address address-set Mail-Server
#
ip service-set Web-Services type group
 service service-set HTTP
 service service-set HTTPS
#
ip service-set Custom-PGSQL type object
 service protocol tcp destination-port 5432
#
time-range Business-Hours
 period-range 08:00:00 to 18:00:00 working-day
#
security-policy
 rule name Allow-LAN-Web
  source-zone trust
  destination-zone untrust
  source-address address-set LAN-Subnet
  service service-set Web-Services
  service DNS
  action permit
  counting enable
  description Allow internal users web browsing and DNS
 rule name Allow-Inbound-Web
  source-zone untrust
  destination-zone dmz
  destination-address address-set Web-Server
  service HTTP
  service HTTPS
  action permit
  counting enable
  description Allow internet users to reach web server
 rule name Allow-Inbound-Mail
  source-zone untrust
  destination-zone dmz
  destination-address address-set Mail-Server
  service SMTP
  action permit
  counting enable
  description Allow inbound SMTP to mail server
 rule name Allow-Admin-SSH
  source-zone trust
  destination-zone dmz
  source-address address-set Admin-PC
  destination-address address-set DMZ-Servers
  source-user admin_group
  service SSH
  action permit
  counting enable
  time-range Business-Hours
  description Allow admin SSH access to DMZ servers during business hours
 rule name Allow-LAN-to-DB
  source-zone trust
  destination-zone trust
  source-address address-set LAN-Subnet
  destination-address address-set DB-Server
  service service-set Custom-PGSQL
  action permit
  counting enable
  description Allow LAN access to PostgreSQL database
 rule name Deny-All-Default
  source-zone untrust
  destination-zone trust
  action deny
  counting enable
  description Default deny all inbound traffic
#
nat-policy
 rule name LAN-Outbound-NAT
  source-zone trust
  destination-zone untrust
  source-address address-set LAN-Subnet
  action source-nat easy-ip
#
ip route-static 0.0.0.0 0.0.0.0 203.0.113.2
ip route-static 10.0.0.0 255.0.0.0 10.1.1.1
#
bgp 65040
 router-id 10.1.1.254
 peer 203.0.113.2 as-number 65100
 peer 203.0.113.2 description ISP-Primary
 peer 10.1.1.253 as-number 65040
 peer 10.1.1.253 description HA-Peer
 address-family ipv4 unicast
  peer 203.0.113.2 enable
  peer 10.1.1.253 enable
  network 10.1.1.0 255.255.255.0
  import-route static
#
ospf 1 router-id 10.1.1.254
 area 0.0.0.0
  network 10.1.1.0 0.0.0.255
  network 203.0.113.0 0.0.0.3
 area 0.0.0.1
  stub
  network 172.16.1.0 0.0.0.255
 import-route static
#
ospfv3 1 router-id 10.1.1.254
 area 0.0.0.0
 area 0.0.0.2
  nssa
 import-route static
#`,
  },

  panos_multivsys: {
    vendor: 'panos',
    label: 'Multi-Vsys (2 vsys)',
    description: 'Two virtual systems: vsys1 (trust/untrust, 3 rules) + vsys2 (dmz/mgmt, 2 rules). Triggers auto-split.',
    xml: `<?xml version="1.0"?>
<config version="10.2.0" urldb="paloaltonetworks">
  <devices><entry name="localhost.localdomain">
    <vsys>
      <entry name="vsys1">
        <zone><entry name="trust"><network><layer3><member>ethernet1/1</member></layer3></network></entry>
              <entry name="untrust"><network><layer3><member>ethernet1/2</member></layer3></network></entry></zone>
        <address>
          <entry name="Web-Server"><ip-netmask>10.1.1.10/32</ip-netmask></entry>
          <entry name="App-Server"><ip-netmask>10.1.1.20/32</ip-netmask></entry>
          <entry name="LAN-Net"><ip-netmask>10.1.0.0/16</ip-netmask></entry>
        </address>
        <rulebase><security><rules>
          <entry name="Allow-Outbound"><from><member>trust</member></from><to><member>untrust</member></to><source><member>LAN-Net</member></source><destination><member>any</member></destination><application><member>web-browsing</member><member>ssl</member><member>dns</member></application><action>allow</action></entry>
          <entry name="Allow-Inbound-HTTPS"><from><member>untrust</member></from><to><member>trust</member></to><source><member>any</member></source><destination><member>Web-Server</member></destination><service><member>service-https</member></service><action>allow</action></entry>
          <entry name="Deny-All-Vsys1"><from><member>any</member></from><to><member>any</member></to><source><member>any</member></source><destination><member>any</member></destination><application><member>any</member></application><action>deny</action></entry>
        </rules></security></rulebase>
      </entry>
      <entry name="vsys2">
        <zone><entry name="dmz"><network><layer3><member>ethernet1/3</member></layer3></network></entry>
              <entry name="mgmt"><network><layer3><member>ethernet1/4</member></layer3></network></entry></zone>
        <address>
          <entry name="DMZ-Server"><ip-netmask>172.16.1.10/32</ip-netmask></entry>
          <entry name="Mgmt-Net"><ip-netmask>192.168.100.0/24</ip-netmask></entry>
        </address>
        <rulebase><security><rules>
          <entry name="Allow-DMZ-to-Mgmt"><from><member>dmz</member></from><to><member>mgmt</member></to><source><member>DMZ-Server</member></source><destination><member>Mgmt-Net</member></destination><service><member>service-https</member></service><action>allow</action></entry>
          <entry name="Deny-All-Vsys2"><from><member>any</member></from><to><member>any</member></to><source><member>any</member></source><destination><member>any</member></destination><application><member>any</member></application><action>deny</action></entry>
        </rules></security></rulebase>
      </entry>
    </vsys>
    <network>
      <interface><ethernet>
        <entry name="ethernet1/1"><layer3><ip><entry name="10.1.1.1/24"/></ip><ipv6><address><entry name="2001:db8:1::1/64"/></address></ipv6></layer3></entry>
        <entry name="ethernet1/2"><layer3><ip><entry name="203.0.113.1/30"/></ip><ipv6><address><entry name="2001:db8:ffff::1/126"/></address></ipv6></layer3></entry>
        <entry name="ethernet1/3"><layer3><ip><entry name="172.16.1.1/24"/></ip><ipv6><address><entry name="2001:db8:a::1/64"/></address></ipv6></layer3></entry>
        <entry name="ethernet1/4"><layer3><ip><entry name="192.168.100.1/24"/></ip></layer3></entry>
      </ethernet></interface>
      <virtual-router><entry name="default"><routing-table><ip><static-route>
        <entry name="default-route"><nexthop><ip-address>203.0.113.2</ip-address></nexthop><destination>0.0.0.0/0</destination><interface>ethernet1/2</interface></entry>
      </static-route></ip></routing-table></entry></virtual-router>
    </network>
  </entry></devices>
</config>`,
  },

  fortigate_multivdom: {
    vendor: 'fortigate',
    label: 'Multi-VDOM (2 VDOMs)',
    description: 'Two VDOMs: root (LAN/WAN, 3 rules) + guest (guest/wan, 2 rules). Triggers auto-split.',
    xml: `config global
end
config vdom
edit root
config system interface
  edit "port1"
    set vdom "root"
    set ip 10.10.1.1 255.255.255.0
    set type physical
    set allowaccess ping https ssh
  next
  edit "port2"
    set vdom "root"
    set ip 203.0.113.1 255.255.255.252
    set type physical
  next
end
config firewall address
  edit "LAN-Subnet"
    set subnet 10.10.1.0 255.255.255.0
  next
  edit "File-Server"
    set type ipmask
    set subnet 10.10.1.50 255.255.255.255
  next
end
config firewall policy
  edit 1
    set name "Allow-LAN-Outbound"
    set srcintf "port1"
    set dstintf "port2"
    set srcaddr "LAN-Subnet"
    set dstaddr "all"
    set action accept
    set schedule "always"
    set service "HTTP" "HTTPS" "DNS"
    set nat enable
  next
  edit 2
    set name "Allow-Inbound-HTTPS"
    set srcintf "port2"
    set dstintf "port1"
    set srcaddr "all"
    set dstaddr "File-Server"
    set action accept
    set schedule "always"
    set service "HTTPS"
  next
  edit 3
    set name "Deny-All-Root"
    set srcintf "any"
    set dstintf "any"
    set srcaddr "all"
    set dstaddr "all"
    set action deny
    set schedule "always"
    set service "ALL"
  next
end
config router static
  edit 1
    set gateway 203.0.113.2
    set device "port2"
  next
end
end
edit guest
config system interface
  edit "port3"
    set vdom "guest"
    set ip 192.168.50.1 255.255.255.0
    set type physical
    set allowaccess ping
  next
  edit "port4"
    set vdom "guest"
    set ip 203.0.113.5 255.255.255.252
    set type physical
  next
end
config firewall address
  edit "Guest-Net"
    set subnet 192.168.50.0 255.255.255.0
  next
end
config firewall policy
  edit 1
    set name "Allow-Guest-Internet"
    set srcintf "port3"
    set dstintf "port4"
    set srcaddr "Guest-Net"
    set dstaddr "all"
    set action accept
    set schedule "always"
    set service "HTTP" "HTTPS" "DNS"
    set nat enable
  next
  edit 2
    set name "Deny-Guest-Default"
    set srcintf "any"
    set dstintf "any"
    set srcaddr "all"
    set dstaddr "all"
    set action deny
    set schedule "always"
    set service "ALL"
  next
end
config router static
  edit 1
    set gateway 203.0.113.6
    set device "port4"
  next
end
end
end`,
  },

  srx_logicalsystems: {
    vendor: 'srx',
    label: 'Logical-Systems (2 LS)',
    description: 'Two logical-systems: LS-BRANCH (trust/untrust, 3 rules) + LS-DC (servers/mgmt, 2 rules) with shared trust zone for cross-LS.',
    xml: `set logical-systems LS-BRANCH interfaces ge-0/0/0 unit 0 family inet address 10.1.1.1/24
set logical-systems LS-BRANCH interfaces ge-0/0/1 unit 0 family inet address 203.0.113.1/30
set logical-systems LS-BRANCH security zones security-zone trust interfaces ge-0/0/0.0
set logical-systems LS-BRANCH security zones security-zone trust host-inbound-traffic system-services ping
set logical-systems LS-BRANCH security zones security-zone untrust interfaces ge-0/0/1.0
set logical-systems LS-BRANCH security zones security-zone untrust screen untrust-screen
set logical-systems LS-BRANCH security address-book global address Branch-LAN 10.1.0.0/16
set logical-systems LS-BRANCH security address-book global address Web-Server 10.1.1.10/32
set logical-systems LS-BRANCH security policies from-zone trust to-zone untrust policy Allow-Outbound match source-address Branch-LAN
set logical-systems LS-BRANCH security policies from-zone trust to-zone untrust policy Allow-Outbound match destination-address any
set logical-systems LS-BRANCH security policies from-zone trust to-zone untrust policy Allow-Outbound match application junos-http
set logical-systems LS-BRANCH security policies from-zone trust to-zone untrust policy Allow-Outbound match application junos-https
set logical-systems LS-BRANCH security policies from-zone trust to-zone untrust policy Allow-Outbound match application junos-dns-udp
set logical-systems LS-BRANCH security policies from-zone trust to-zone untrust policy Allow-Outbound then permit
set logical-systems LS-BRANCH security policies from-zone untrust to-zone trust policy Allow-Inbound-HTTPS match source-address any
set logical-systems LS-BRANCH security policies from-zone untrust to-zone trust policy Allow-Inbound-HTTPS match destination-address Web-Server
set logical-systems LS-BRANCH security policies from-zone untrust to-zone trust policy Allow-Inbound-HTTPS match application junos-https
set logical-systems LS-BRANCH security policies from-zone untrust to-zone trust policy Allow-Inbound-HTTPS then permit
set logical-systems LS-BRANCH security policies default-policy deny-all
set logical-systems LS-BRANCH routing-options static route 0.0.0.0/0 next-hop 203.0.113.2
set logical-systems LS-DC interfaces ge-0/0/2 unit 0 family inet address 172.16.1.1/24
set logical-systems LS-DC interfaces ge-0/0/3 unit 0 family inet address 192.168.200.1/24
set logical-systems LS-DC security zones security-zone servers interfaces ge-0/0/2.0
set logical-systems LS-DC security zones security-zone servers host-inbound-traffic system-services ping
set logical-systems LS-DC security zones security-zone mgmt interfaces ge-0/0/3.0
set logical-systems LS-DC security zones security-zone mgmt host-inbound-traffic system-services ssh
set logical-systems LS-DC security zones security-zone trust
set logical-systems LS-DC security address-book global address DC-Servers 172.16.1.0/24
set logical-systems LS-DC security address-book global address Mgmt-Net 192.168.200.0/24
set logical-systems LS-DC security address-book global address Admin-PC 192.168.200.10/32
set logical-systems LS-DC security policies from-zone mgmt to-zone servers policy Admin-Access match source-address Admin-PC
set logical-systems LS-DC security policies from-zone mgmt to-zone servers policy Admin-Access match destination-address DC-Servers
set logical-systems LS-DC security policies from-zone mgmt to-zone servers policy Admin-Access match application junos-ssh
set logical-systems LS-DC security policies from-zone mgmt to-zone servers policy Admin-Access match application junos-https
set logical-systems LS-DC security policies from-zone mgmt to-zone servers policy Admin-Access then permit
set logical-systems LS-DC security policies default-policy deny-all
set logical-systems LS-DC routing-options static route 0.0.0.0/0 next-hop 172.16.1.254`,
  },

  srx_tenants: {
    vendor: 'srx',
    label: 'Tenant (1 tenant)',
    description: 'Single tenant TENANT-A with 2 zones and 2 security policies. Tests tenant parsing path.',
    xml: `set tenants TENANT-A interfaces ge-0/0/5 unit 0 family inet address 10.50.1.1/24
set tenants TENANT-A interfaces ge-0/0/6 unit 0 family inet address 10.50.2.1/24
set tenants TENANT-A security zones security-zone internal interfaces ge-0/0/5.0
set tenants TENANT-A security zones security-zone internal host-inbound-traffic system-services ping
set tenants TENANT-A security zones security-zone external interfaces ge-0/0/6.0
set tenants TENANT-A security address-book global address Tenant-LAN 10.50.1.0/24
set tenants TENANT-A security address-book global address Tenant-Server 10.50.2.10/32
set tenants TENANT-A security policies from-zone internal to-zone external policy Allow-Outbound match source-address Tenant-LAN
set tenants TENANT-A security policies from-zone internal to-zone external policy Allow-Outbound match destination-address any
set tenants TENANT-A security policies from-zone internal to-zone external policy Allow-Outbound match application junos-http
set tenants TENANT-A security policies from-zone internal to-zone external policy Allow-Outbound match application junos-https
set tenants TENANT-A security policies from-zone internal to-zone external policy Allow-Outbound then permit
set tenants TENANT-A security policies from-zone external to-zone internal policy Allow-Server-Access match source-address any
set tenants TENANT-A security policies from-zone external to-zone internal policy Allow-Server-Access match destination-address Tenant-Server
set tenants TENANT-A security policies from-zone external to-zone internal policy Allow-Server-Access match application junos-https
set tenants TENANT-A security policies from-zone external to-zone internal policy Allow-Server-Access then permit
set tenants TENANT-A security policies default-policy deny-all
set tenants TENANT-A routing-options static route 0.0.0.0/0 next-hop 10.50.2.254`,
  },

  // =========================================================================
  // SAMPLE: GCP Firewall Rules — Simple (Default VPC, Web Server)
  // =========================================================================
  gcp_fw_simple: {
    vendor: 'gcp_fw',
    label: 'Simple (6 rules)',
    description: 'GCP VPC: default-network web server — IAP SSH, HTTP/HTTPS to tagged instances, internal allow, ICMP, deny-all ingress fallback',
    xml: `[
  {
    "name": "allow-iap-ssh",
    "description": "Allow SSH from Google IAP tunnel range to all instances",
    "network": "https://www.googleapis.com/compute/v1/projects/my-project/global/networks/default",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["35.235.240.0/20"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["22"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "allow-http-to-web-servers",
    "description": "Allow HTTP from internet to instances tagged http-server",
    "network": "https://www.googleapis.com/compute/v1/projects/my-project/global/networks/default",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": ["http-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["80"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-https-to-web-servers",
    "description": "Allow HTTPS from internet to instances tagged https-server",
    "network": "https://www.googleapis.com/compute/v1/projects/my-project/global/networks/default",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": ["https-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-internal",
    "description": "Allow all traffic between instances on the default VPC subnet ranges",
    "network": "https://www.googleapis.com/compute/v1/projects/my-project/global/networks/default",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["10.128.0.0/9"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["0-65535"] },
      { "IPProtocol": "udp", "ports": ["0-65535"] },
      { "IPProtocol": "icmp" }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-icmp",
    "description": "Allow ICMP from anywhere for diagnostics and ping",
    "network": "https://www.googleapis.com/compute/v1/projects/my-project/global/networks/default",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "icmp" }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "deny-all-ingress",
    "description": "Implicit deny-all ingress fallback — lower priority than all allow rules",
    "network": "https://www.googleapis.com/compute/v1/projects/my-project/global/networks/default",
    "direction": "INGRESS",
    "priority": 65534,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": [],
    "denied": [
      { "IPProtocol": "all" }
    ],
    "logConfig": { "enable": true }
  }
]`,
  },

  // =========================================================================
  // SAMPLE: GCP Firewall Rules — Medium (3-Tier App with Tags)
  // =========================================================================
  gcp_fw_medium: {
    vendor: 'gcp_fw',
    label: 'Medium (11 rules)',
    description: 'GCP VPC: 3-tier app with target tags — IAP, LB health checks, tag-to-tag web→app→db, NTP/DNS egress, deny-all fallbacks',
    xml: `[
  {
    "name": "allow-iap-ssh-all-tiers",
    "description": "Allow SSH via Google IAP to all application tiers",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 500,
    "disabled": false,
    "sourceRanges": ["35.235.240.0/20"],
    "targetTags": ["web-server", "app-server", "db-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["22"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "allow-lb-health-check-to-web",
    "description": "Allow Google Cloud Load Balancer health check probes to web tier",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["130.211.0.0/22", "35.191.0.0/16"],
    "targetTags": ["web-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["80", "443", "8080"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-internet-to-web",
    "description": "Allow HTTPS from internet to web tier instances",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": ["web-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["80", "443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-web-to-app",
    "description": "Allow web tier to reach app tier on application ports",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceTags": ["web-server"],
    "targetTags": ["app-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["8080", "8443"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "allow-lb-health-check-to-app",
    "description": "Allow GCP internal load balancer health checks to app tier",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["130.211.0.0/22", "35.191.0.0/16"],
    "targetTags": ["app-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["8080"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-app-to-db",
    "description": "Allow app tier to reach Cloud SQL / Postgres on db tier",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceTags": ["app-server"],
    "targetTags": ["db-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["5432", "3306"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "allow-app-egress-google-apis",
    "description": "Allow app tier outbound to Google APIs (storage, pubsub, monitoring)",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "EGRESS",
    "priority": 1000,
    "disabled": false,
    "targetTags": ["app-server"],
    "destinationRanges": ["199.36.153.8/30", "199.36.153.4/30"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-ntp-egress",
    "description": "Allow NTP time synchronization egress to Google time servers",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "EGRESS",
    "priority": 1000,
    "disabled": false,
    "targetTags": [],
    "destinationRanges": ["216.239.35.0/24"],
    "allowed": [
      { "IPProtocol": "udp", "ports": ["123"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "allow-dns-egress",
    "description": "Allow DNS queries to Google public DNS and internal resolvers",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "EGRESS",
    "priority": 1000,
    "disabled": false,
    "targetTags": [],
    "destinationRanges": ["8.8.8.8/32", "8.8.4.4/32", "169.254.169.254/32"],
    "allowed": [
      { "IPProtocol": "udp", "ports": ["53"] },
      { "IPProtocol": "tcp", "ports": ["53"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "deny-all-ingress-fallback",
    "description": "Deny-all ingress fallback — must come after all allow rules",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "INGRESS",
    "priority": 65534,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": [],
    "denied": [
      { "IPProtocol": "all" }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "deny-all-egress-fallback",
    "description": "Deny-all egress fallback — explicit allow rules above take precedence",
    "network": "https://www.googleapis.com/compute/v1/projects/prod-project/global/networks/app-vpc",
    "direction": "EGRESS",
    "priority": 65534,
    "disabled": false,
    "targetTags": [],
    "destinationRanges": ["0.0.0.0/0"],
    "denied": [
      { "IPProtocol": "all" }
    ],
    "logConfig": { "enable": true }
  }
]`,
  },

  // =========================================================================
  // SAMPLE: GCP Firewall Rules — Complex (Enterprise Multi-VPC)
  // =========================================================================
  gcp_fw_complex: {
    vendor: 'gcp_fw',
    label: 'Complex (18 rules)',
    description: 'GCP VPC: enterprise prod+mgmt networks — service accounts, priority ordering, disabled rules, Cloud Armor, VPC peering, logging, ICMP, ephemeral ports',
    xml: `[
  {
    "name": "prod-allow-iap-ssh",
    "description": "Allow SSH via IAP to all prod instances — only path for interactive access",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 100,
    "disabled": false,
    "sourceRanges": ["35.235.240.0/20"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["22"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "prod-allow-lb-health-checks",
    "description": "Allow GCP LB and health check probes to frontend and backend MIGs",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 200,
    "disabled": false,
    "sourceRanges": ["130.211.0.0/22", "35.191.0.0/16", "209.85.152.0/22", "209.85.204.0/22"],
    "targetTags": ["allow-health-check"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["80", "443", "8080", "8443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-allow-https-frontend",
    "description": "Allow HTTPS from internet to frontend load balancer backends",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": ["frontend"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["443"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "prod-allow-frontend-to-backend-sa",
    "description": "Allow frontend service account to reach backend service account on app port",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceServiceAccounts": ["frontend-sa@enterprise-prod.iam.gserviceaccount.com"],
    "targetServiceAccounts": ["backend-sa@enterprise-prod.iam.gserviceaccount.com"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["8443"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "prod-allow-backend-to-cloudsql-sa",
    "description": "Allow backend SA to reach Cloud SQL Auth Proxy on localhost — proxy egress to SQL",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceServiceAccounts": ["backend-sa@enterprise-prod.iam.gserviceaccount.com"],
    "targetServiceAccounts": ["cloudsql-sa@enterprise-prod.iam.gserviceaccount.com"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["5432", "3306", "1433"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "prod-allow-redis-from-backend",
    "description": "Allow backend tier to reach Memorystore Redis (VPC-native peering range)",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceTags": ["backend"],
    "targetTags": ["redis-client"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["6379", "6380"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-allow-internal-peering",
    "description": "Allow all traffic from VPC peering with shared-services VPC",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["10.20.0.0/14"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["0-65535"] },
      { "IPProtocol": "udp", "ports": ["0-65535"] },
      { "IPProtocol": "icmp" }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-allow-icmp-monitoring",
    "description": "Allow ICMP from Cloud Monitoring and on-prem monitoring subnet for uptime checks",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["35.199.192.0/19", "10.0.0.0/8"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "icmp" }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-allow-egress-google-apis-restricted",
    "description": "Allow egress to restricted.googleapis.com VIP for private Google API access",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "EGRESS",
    "priority": 500,
    "disabled": false,
    "targetTags": [],
    "destinationRanges": ["199.36.153.4/30"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-allow-egress-artifact-registry",
    "description": "Allow container image pulls from Artifact Registry (private VIP)",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "EGRESS",
    "priority": 600,
    "disabled": false,
    "targetTags": ["backend", "frontend"],
    "destinationRanges": ["199.36.153.8/30"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-allow-egress-cloud-logging",
    "description": "Allow log export to Cloud Logging and Cloud Monitoring via Ops Agent",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "EGRESS",
    "priority": 700,
    "disabled": false,
    "targetTags": [],
    "destinationRanges": ["169.254.169.254/32", "169.254.8.129/32"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["443", "8443"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "prod-deny-egress-to-internet",
    "description": "Deny direct internet egress — all internet traffic must route through Cloud NAT or proxy",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "EGRESS",
    "priority": 65000,
    "disabled": false,
    "targetTags": [],
    "destinationRanges": ["0.0.0.0/0"],
    "denied": [
      { "IPProtocol": "all" }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "prod-deny-all-ingress-fallback",
    "description": "Deny all remaining ingress — implicit GCP deny made explicit with logging",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/prod-vpc",
    "direction": "INGRESS",
    "priority": 65534,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": [],
    "denied": [
      { "IPProtocol": "all" }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "mgmt-allow-iap-rdp",
    "description": "Allow RDP via IAP to management Windows instances",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/mgmt-vpc",
    "direction": "INGRESS",
    "priority": 100,
    "disabled": false,
    "sourceRanges": ["35.235.240.0/20"],
    "targetTags": ["windows-mgmt"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["3389"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "mgmt-allow-vpn-admin",
    "description": "Allow admin access from on-prem site via Cloud VPN tunnel",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/mgmt-vpc",
    "direction": "INGRESS",
    "priority": 500,
    "disabled": false,
    "sourceRanges": ["192.168.100.0/24", "192.168.101.0/24"],
    "targetTags": ["mgmt-server"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["22", "443", "8443"] },
      { "IPProtocol": "icmp" }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "mgmt-allow-monitoring-scrape",
    "description": "Allow Prometheus scrape from monitoring server to all mgmt instances",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/mgmt-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": false,
    "sourceRanges": ["10.20.1.0/28"],
    "targetTags": [],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["9090", "9100", "9091"] }
    ],
    "logConfig": { "enable": false }
  },
  {
    "name": "mgmt-allow-winrm-disabled",
    "description": "WinRM access — DISABLED, preserved for break-glass use only",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/mgmt-vpc",
    "direction": "INGRESS",
    "priority": 1000,
    "disabled": true,
    "sourceRanges": ["10.20.1.0/28"],
    "targetTags": ["windows-mgmt"],
    "allowed": [
      { "IPProtocol": "tcp", "ports": ["5985", "5986"] }
    ],
    "logConfig": { "enable": true }
  },
  {
    "name": "mgmt-deny-all-ingress-fallback",
    "description": "Deny all ingress to mgmt VPC — stricter than prod, no implicit traffic allowed",
    "network": "https://www.googleapis.com/compute/v1/projects/enterprise-prod/global/networks/mgmt-vpc",
    "direction": "INGRESS",
    "priority": 65534,
    "disabled": false,
    "sourceRanges": ["0.0.0.0/0"],
    "targetTags": [],
    "denied": [
      { "IPProtocol": "all" }
    ],
    "logConfig": { "enable": true }
  }
]`,
  },

  // =========================================================================
  // SAMPLE: AWS Security Groups — Simple (Single Web Server)
  // =========================================================================
  aws_sg_simple: {
    vendor: 'aws_sg',
    label: 'Simple (1 SG, 5 rules)',
    description: 'AWS SG: single web-server security group — HTTP/HTTPS from internet, SSH from bastion, all egress allowed',
    xml: `{
  "SecurityGroups": [
    {
      "GroupId": "sg-0a1b2c3d4e5f67890",
      "GroupName": "web-server-sg",
      "Description": "Security group for public-facing web servers",
      "VpcId": "vpc-0123456789abcdef0",
      "Tags": [
        { "Key": "Name", "Value": "web-server-sg" },
        { "Key": "Environment", "Value": "production" },
        { "Key": "App", "Value": "ecommerce-frontend" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS from internet" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "::/0", "Description": "HTTPS from internet (IPv6)" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 80,
          "ToPort": 80,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTP from internet (redirect to HTTPS)" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "::/0", "Description": "HTTP from internet (IPv6)" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 22,
          "ToPort": 22,
          "IpRanges": [
            { "CidrIp": "10.10.0.5/32", "Description": "SSH from bastion host only" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "-1",
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "Allow all outbound" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "::/0", "Description": "Allow all outbound IPv6" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ]
    }
  ]
}`,
  },

  // =========================================================================
  // SAMPLE: AWS Security Groups — Medium (3-Tier Application)
  // =========================================================================
  aws_sg_medium: {
    vendor: 'aws_sg',
    label: 'Medium (3 SGs, 12 rules)',
    description: 'AWS SG: 3-tier app — web, app, and RDS SGs with cross-SG UserIdGroupPairs, port ranges, S3 prefix list egress',
    xml: `{
  "SecurityGroups": [
    {
      "GroupId": "sg-web-0011aabbcc",
      "GroupName": "web-tier-sg",
      "Description": "Web tier — accepts internet traffic, forwards to app tier",
      "VpcId": "vpc-prod-0a1b2c3d",
      "Tags": [
        { "Key": "Name", "Value": "web-tier-sg" },
        { "Key": "Tier", "Value": "web" },
        { "Key": "Environment", "Value": "production" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS from internet" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "::/0", "Description": "HTTPS from internet (IPv6)" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 80,
          "ToPort": 80,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTP redirect to HTTPS" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 22,
          "ToPort": 22,
          "IpRanges": [
            { "CidrIp": "10.0.255.0/28", "Description": "SSH from bastion subnet" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 8080,
          "ToPort": 8080,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-app-0022bbccdd", "Description": "Forward requests to app tier" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": [
            { "PrefixListId": "pl-63a5400a", "Description": "HTTPS to S3 (Gateway endpoint)" }
          ]
        }
      ]
    },
    {
      "GroupId": "sg-app-0022bbccdd",
      "GroupName": "app-tier-sg",
      "Description": "App tier — accepts requests from web tier, connects to RDS",
      "VpcId": "vpc-prod-0a1b2c3d",
      "Tags": [
        { "Key": "Name", "Value": "app-tier-sg" },
        { "Key": "Tier", "Value": "app" },
        { "Key": "Environment", "Value": "production" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 8080,
          "ToPort": 8080,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-web-0011aabbcc", "Description": "Allow from web tier only" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 22,
          "ToPort": 22,
          "IpRanges": [
            { "CidrIp": "10.0.255.0/28", "Description": "SSH from bastion subnet" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 5432,
          "ToPort": 5432,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-db-0033ccddee", "Description": "PostgreSQL to RDS tier" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": [
            { "PrefixListId": "pl-63a5400a", "Description": "HTTPS to S3 for app assets" }
          ]
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS to AWS services (STS, SSM, CloudWatch)" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ]
    },
    {
      "GroupId": "sg-db-0033ccddee",
      "GroupName": "rds-tier-sg",
      "Description": "RDS PostgreSQL — only accepts connections from app tier",
      "VpcId": "vpc-prod-0a1b2c3d",
      "Tags": [
        { "Key": "Name", "Value": "rds-tier-sg" },
        { "Key": "Tier", "Value": "database" },
        { "Key": "Environment", "Value": "production" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 5432,
          "ToPort": 5432,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-app-0022bbccdd", "Description": "PostgreSQL from app tier only" }
          ],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS to AWS services (backup, monitoring)" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ]
    }
  ]
}`,
  },

  // =========================================================================
  // SAMPLE: AWS Security Groups — Complex (Enterprise 4-SG with IPv6 + Prefix Lists)
  // =========================================================================
  aws_sg_complex: {
    vendor: 'aws_sg',
    label: 'Complex (4 SGs, 24 rules)',
    description: 'AWS SG: enterprise setup — bastion, ALB, ECS app, RDS; IPv6 dual-stack, managed prefix lists, ICMP, ephemeral port egress, cross-SG chaining',
    xml: `{
  "SecurityGroups": [
    {
      "GroupId": "sg-bastion-aabbcc001",
      "GroupName": "bastion-host-sg",
      "Description": "Bastion host — SSH/RDP access from corporate IP ranges only",
      "VpcId": "vpc-enterprise-001",
      "Tags": [
        { "Key": "Name", "Value": "bastion-host-sg" },
        { "Key": "Environment", "Value": "production" },
        { "Key": "Compliance", "Value": "SOC2" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 22,
          "ToPort": 22,
          "IpRanges": [
            { "CidrIp": "203.0.113.0/24", "Description": "SSH from HQ office" },
            { "CidrIp": "198.51.100.0/26", "Description": "SSH from DR site" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "2001:db8::/32", "Description": "SSH from HQ IPv6 range" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 3389,
          "ToPort": 3389,
          "IpRanges": [
            { "CidrIp": "203.0.113.0/24", "Description": "RDP from HQ office" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "icmp",
          "FromPort": 8,
          "ToPort": 0,
          "IpRanges": [
            { "CidrIp": "10.0.0.0/8", "Description": "ICMP echo-request from RFC1918" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 22,
          "ToPort": 22,
          "IpRanges": [
            { "CidrIp": "10.0.0.0/8", "Description": "SSH to any internal host" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 3389,
          "ToPort": 3389,
          "IpRanges": [
            { "CidrIp": "10.0.0.0/8", "Description": "RDP to any internal Windows host" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS to AWS services and package repos" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ]
    },
    {
      "GroupId": "sg-alb-bbcc002233",
      "GroupName": "alb-public-sg",
      "Description": "Application Load Balancer — dual-stack internet-facing",
      "VpcId": "vpc-enterprise-001",
      "Tags": [
        { "Key": "Name", "Value": "alb-public-sg" },
        { "Key": "Environment", "Value": "production" },
        { "Key": "Compliance", "Value": "PCI-DSS" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS from internet" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "::/0", "Description": "HTTPS from internet (IPv6)" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 80,
          "ToPort": 80,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTP redirect to HTTPS" }
          ],
          "Ipv6Ranges": [
            { "CidrIpv6": "::/0", "Description": "HTTP redirect (IPv6)" }
          ],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 8443,
          "ToPort": 8443,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-ecs-ccdd003344", "Description": "ALB to ECS tasks on HTTPS listener port" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 1024,
          "ToPort": 65535,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-ecs-ccdd003344", "Description": "Ephemeral return ports to ECS targets" }
          ],
          "PrefixListIds": []
        }
      ]
    },
    {
      "GroupId": "sg-ecs-ccdd003344",
      "GroupName": "ecs-app-sg",
      "Description": "ECS Fargate tasks — accepts from ALB, accesses RDS, ElastiCache, and AWS services",
      "VpcId": "vpc-enterprise-001",
      "Tags": [
        { "Key": "Name", "Value": "ecs-app-sg" },
        { "Key": "Environment", "Value": "production" },
        { "Key": "Compliance", "Value": "SOC2" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 8443,
          "ToPort": 8443,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-alb-bbcc002233", "Description": "HTTPS from ALB only" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 22,
          "ToPort": 22,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-bastion-aabbcc001", "Description": "SSH from bastion for debugging" }
          ],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 5432,
          "ToPort": 5432,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-rds-ddee004455", "Description": "PostgreSQL to RDS Aurora cluster" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 6379,
          "ToPort": 6380,
          "IpRanges": [
            { "CidrIp": "10.0.3.0/29", "Description": "Redis/Valkey ElastiCache cluster nodes" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": [
            { "PrefixListId": "pl-63a5400a", "Description": "S3 Gateway endpoint (assets, logs)" },
            { "PrefixListId": "pl-02cd2c6b", "Description": "DynamoDB Gateway endpoint (session store)" }
          ]
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS to AWS APIs (SSM, Secrets Manager, ECR, CloudWatch)" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "udp",
          "FromPort": 53,
          "ToPort": 53,
          "IpRanges": [
            { "CidrIp": "10.0.0.2/32", "Description": "DNS to VPC resolver" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 587,
          "ToPort": 587,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "SMTP submission to SES / transactional email" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ]
    },
    {
      "GroupId": "sg-rds-ddee004455",
      "GroupName": "rds-aurora-sg",
      "Description": "Aurora PostgreSQL cluster — writer and reader endpoints, app tier access only",
      "VpcId": "vpc-enterprise-001",
      "Tags": [
        { "Key": "Name", "Value": "rds-aurora-sg" },
        { "Key": "Environment", "Value": "production" },
        { "Key": "Compliance", "Value": "PCI-DSS" }
      ],
      "IpPermissions": [
        {
          "IpProtocol": "tcp",
          "FromPort": 5432,
          "ToPort": 5432,
          "IpRanges": [],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [
            { "GroupId": "sg-ecs-ccdd003344", "Description": "PostgreSQL from ECS app tasks" }
          ],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 5432,
          "ToPort": 5432,
          "IpRanges": [
            { "CidrIp": "10.0.255.0/28", "Description": "Direct DB access from bastion for DBA work" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "icmp",
          "FromPort": 8,
          "ToPort": 0,
          "IpRanges": [
            { "CidrIp": "10.0.0.0/8", "Description": "ICMP echo from monitoring system" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ],
      "IpPermissionsEgress": [
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": [
            { "CidrIp": "0.0.0.0/0", "Description": "HTTPS to AWS RDS services (backups, audit export)" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 5432,
          "ToPort": 5432,
          "IpRanges": [
            { "CidrIp": "10.0.2.0/28", "Description": "Aurora replication to read replica subnet" }
          ],
          "Ipv6Ranges": [],
          "UserIdGroupPairs": [],
          "PrefixListIds": []
        }
      ]
    }
  ]
}`,
  },

  // =========================================================================
  // SAMPLE: Azure NSG — Simple (Web App)
  // =========================================================================
  azure_nsg_simple: {
    vendor: 'azure_nsg',
    label: 'Simple (6 rules)',
    description: 'Azure NSG: basic web app — allow HTTPS/HTTP inbound, SSH from mgmt IP, deny all inbound, allow outbound',
    xml: `{
  "name": "nsg-webapp-frontend",
  "location": "eastus",
  "tags": {
    "environment": "production",
    "app": "web-frontend"
  },
  "securityRules": [
    {
      "name": "Allow-HTTPS-Inbound",
      "properties": {
        "priority": 100,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "Internet",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.0.1.0/24",
        "destinationPortRange": "443",
        "description": "Allow HTTPS traffic from internet to web tier"
      }
    },
    {
      "name": "Allow-HTTP-Inbound",
      "properties": {
        "priority": 110,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "Internet",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.0.1.0/24",
        "destinationPortRange": "80",
        "description": "Allow HTTP for redirect to HTTPS"
      }
    },
    {
      "name": "Allow-SSH-From-Mgmt",
      "properties": {
        "priority": 200,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.10.0.5/32",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.0.1.0/24",
        "destinationPortRange": "22",
        "description": "Allow SSH from management jump host only"
      }
    },
    {
      "name": "Allow-AzureLoadBalancer",
      "properties": {
        "priority": 300,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "*",
        "sourceAddressPrefix": "AzureLoadBalancer",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Allow Azure Load Balancer health probes"
      }
    },
    {
      "name": "Deny-All-Inbound",
      "properties": {
        "priority": 4000,
        "direction": "Inbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "*",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Deny all other inbound traffic"
      }
    },
    {
      "name": "Allow-All-Outbound",
      "properties": {
        "priority": 100,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "*",
        "sourceAddressPrefix": "10.0.1.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Allow all outbound traffic"
      }
    }
  ]
}`,
  },

  // =========================================================================
  // SAMPLE: Azure NSG — Medium (3-Tier Application)
  // =========================================================================
  azure_nsg_medium: {
    vendor: 'azure_nsg',
    label: 'Medium (14 rules)',
    description: 'Azure NSG: 3-tier app — web, app, and DB subnets with service tags, health probes, management access, and inter-tier restrictions',
    xml: `{
  "name": "nsg-app-tier",
  "location": "eastus2",
  "tags": {
    "environment": "production",
    "tier": "application",
    "costcenter": "it-ops"
  },
  "securityRules": [
    {
      "name": "Allow-Web-To-App-HTTP",
      "properties": {
        "priority": 100,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.0.1.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.0.2.0/24",
        "destinationPortRanges": ["8080", "8443"],
        "description": "Allow web tier to reach app tier on app ports"
      }
    },
    {
      "name": "Allow-App-To-DB-SQL",
      "properties": {
        "priority": 110,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.0.2.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.0.3.0/24",
        "destinationPortRange": "1433",
        "description": "Allow app tier to reach SQL database"
      }
    },
    {
      "name": "Allow-App-To-DB-Redis",
      "properties": {
        "priority": 120,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.0.2.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.0.3.0/24",
        "destinationPortRange": "6379",
        "description": "Allow app tier to reach Redis cache"
      }
    },
    {
      "name": "Allow-SSH-From-Bastion",
      "properties": {
        "priority": 200,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.10.0.0/27",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "VirtualNetwork",
        "destinationPortRange": "22",
        "description": "Allow SSH from Azure Bastion subnet"
      }
    },
    {
      "name": "Allow-RDP-From-Bastion",
      "properties": {
        "priority": 210,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.10.0.0/27",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "VirtualNetwork",
        "destinationPortRange": "3389",
        "description": "Allow RDP from Azure Bastion subnet"
      }
    },
    {
      "name": "Allow-AzureMonitor-Outbound",
      "properties": {
        "priority": 300,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureMonitor",
        "destinationPortRanges": ["443", "1886"],
        "description": "Allow telemetry to Azure Monitor"
      }
    },
    {
      "name": "Allow-AzureStorage-Outbound",
      "properties": {
        "priority": 310,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "Storage",
        "destinationPortRange": "443",
        "description": "Allow access to Azure Blob Storage"
      }
    },
    {
      "name": "Allow-KeyVault-Outbound",
      "properties": {
        "priority": 320,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureKeyVault",
        "destinationPortRange": "443",
        "description": "Allow access to Azure Key Vault for secrets"
      }
    },
    {
      "name": "Allow-AzureActiveDirectory-Outbound",
      "properties": {
        "priority": 330,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureActiveDirectory",
        "destinationPortRange": "443",
        "description": "Allow AAD authentication traffic"
      }
    },
    {
      "name": "Allow-AzureLoadBalancer-Inbound",
      "properties": {
        "priority": 400,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "*",
        "sourceAddressPrefix": "AzureLoadBalancer",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Allow Azure Load Balancer health probes"
      }
    },
    {
      "name": "Allow-NTP-Outbound",
      "properties": {
        "priority": 400,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Udp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "Internet",
        "destinationPortRange": "123",
        "description": "Allow NTP for time synchronization"
      }
    },
    {
      "name": "Allow-DNS-Outbound",
      "properties": {
        "priority": 410,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Udp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "168.63.129.16/32",
        "destinationPortRange": "53",
        "description": "Allow DNS to Azure DNS resolver"
      }
    },
    {
      "name": "Deny-Internet-Inbound",
      "properties": {
        "priority": 4000,
        "direction": "Inbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "Internet",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Deny direct internet inbound — traffic must go through load balancer"
      }
    },
    {
      "name": "Deny-Internet-Outbound",
      "properties": {
        "priority": 4000,
        "direction": "Outbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "*",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "Internet",
        "destinationPortRange": "*",
        "description": "Deny direct internet outbound — route through Azure Firewall"
      }
    }
  ]
}`,
  },

  // =========================================================================
  // SAMPLE: Azure NSG — Complex (Enterprise Hub-Spoke)
  // =========================================================================
  azure_nsg_complex: {
    vendor: 'azure_nsg',
    label: 'Complex (22 rules)',
    description: 'Azure NSG: enterprise hub-spoke — multiple workload subnets, service tags, ICMP, complex port ranges, micro-segmentation, compliance deny rules',
    xml: `{
  "name": "nsg-enterprise-workload",
  "location": "westus2",
  "tags": {
    "environment": "production",
    "compliance": "PCI-DSS",
    "owner": "network-team",
    "costcenter": "infra-shared"
  },
  "securityRules": [
    {
      "name": "Allow-AppGateway-V2-Inbound",
      "properties": {
        "priority": 100,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "GatewayManager",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "65200-65535",
        "description": "Required for Azure Application Gateway v2 infrastructure communication"
      }
    },
    {
      "name": "Allow-HTTPS-From-AppGW",
      "properties": {
        "priority": 110,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.0.0.0/27",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.0.0/24",
        "destinationPortRange": "443",
        "description": "Allow HTTPS from Application Gateway subnet to web tier"
      }
    },
    {
      "name": "Allow-HTTP-From-AppGW",
      "properties": {
        "priority": 120,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.0.0.0/27",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.0.0/24",
        "destinationPortRange": "80",
        "description": "Allow HTTP from Application Gateway for redirect"
      }
    },
    {
      "name": "Allow-Web-To-App-Internal",
      "properties": {
        "priority": 200,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.1.0.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.1.0/24",
        "destinationPortRanges": ["8080", "8443", "8000-8090"],
        "description": "Allow web tier to internal app tier on application ports"
      }
    },
    {
      "name": "Allow-App-To-DB-Primary",
      "properties": {
        "priority": 210,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.1.1.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.2.0/28",
        "destinationPortRanges": ["1433", "5432", "3306"],
        "description": "Allow app tier to database subnet (MSSQL, PostgreSQL, MySQL)"
      }
    },
    {
      "name": "Allow-App-To-Cache",
      "properties": {
        "priority": 220,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.1.1.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.3.0/29",
        "destinationPortRanges": ["6379", "6380"],
        "description": "Allow app tier to Redis cache (non-TLS and TLS)"
      }
    },
    {
      "name": "Allow-App-To-ServiceBus",
      "properties": {
        "priority": 230,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.1.1.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "ServiceBus",
        "destinationPortRanges": ["443", "5671", "5672"],
        "description": "Allow AMQP and AMQPS to Azure Service Bus"
      }
    },
    {
      "name": "Allow-Hub-Firewall-Management",
      "properties": {
        "priority": 300,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.0.1.0/26",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "VirtualNetwork",
        "destinationPortRanges": ["22", "3389", "5986"],
        "description": "Allow management access from hub firewall subnet (SSH, RDP, WinRM)"
      }
    },
    {
      "name": "Allow-Monitoring-Outbound",
      "properties": {
        "priority": 310,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureMonitor",
        "destinationPortRanges": ["443", "1886"],
        "description": "Allow Azure Monitor, Log Analytics agent telemetry"
      }
    },
    {
      "name": "Allow-Backup-Outbound",
      "properties": {
        "priority": 320,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureBackup",
        "destinationPortRange": "443",
        "description": "Allow Azure Backup agent to Recovery Services Vault"
      }
    },
    {
      "name": "Allow-Storage-Outbound",
      "properties": {
        "priority": 330,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "Storage",
        "destinationPortRange": "443",
        "description": "Allow access to Azure Storage (blobs, queues, tables)"
      }
    },
    {
      "name": "Allow-KeyVault-Outbound",
      "properties": {
        "priority": 340,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureKeyVault",
        "destinationPortRange": "443",
        "description": "Allow secrets and certificate retrieval from Key Vault"
      }
    },
    {
      "name": "Allow-AAD-Outbound",
      "properties": {
        "priority": 350,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Tcp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "AzureActiveDirectory",
        "destinationPortRange": "443",
        "description": "Allow Entra ID (AAD) authentication and token acquisition"
      }
    },
    {
      "name": "Allow-DNS-Outbound",
      "properties": {
        "priority": 360,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Udp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "168.63.129.16/32",
        "destinationPortRange": "53",
        "description": "Allow DNS resolution via Azure DNS (168.63.129.16)"
      }
    },
    {
      "name": "Allow-NTP-Outbound",
      "properties": {
        "priority": 370,
        "direction": "Outbound",
        "access": "Allow",
        "protocol": "Udp",
        "sourceAddressPrefix": "VirtualNetwork",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "Internet",
        "destinationPortRange": "123",
        "description": "Allow NTP time synchronization"
      }
    },
    {
      "name": "Allow-ICMP-Internal",
      "properties": {
        "priority": 380,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "Icmp",
        "sourceAddressPrefix": "10.0.0.0/8",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "VirtualNetwork",
        "destinationPortRange": "*",
        "description": "Allow ICMP ping within RFC1918 address space for diagnostics"
      }
    },
    {
      "name": "Allow-AzureLoadBalancer-Inbound",
      "properties": {
        "priority": 400,
        "direction": "Inbound",
        "access": "Allow",
        "protocol": "*",
        "sourceAddressPrefix": "AzureLoadBalancer",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Required: Azure Load Balancer health probe"
      }
    },
    {
      "name": "Deny-DB-From-Web-Direct",
      "properties": {
        "priority": 500,
        "direction": "Inbound",
        "access": "Deny",
        "protocol": "Tcp",
        "sourceAddressPrefix": "10.1.0.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.2.0/28",
        "destinationPortRange": "*",
        "description": "PCI compliance: deny web tier direct access to database subnet"
      }
    },
    {
      "name": "Deny-Lateral-Movement-Web",
      "properties": {
        "priority": 510,
        "direction": "Inbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "10.1.0.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.0.0/24",
        "destinationPortRange": "*",
        "description": "Block lateral movement within web tier subnet"
      }
    },
    {
      "name": "Deny-Lateral-Movement-App",
      "properties": {
        "priority": 520,
        "direction": "Inbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "10.1.1.0/24",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "10.1.1.0/24",
        "destinationPortRange": "*",
        "description": "Block lateral movement within app tier subnet"
      }
    },
    {
      "name": "Deny-All-Inbound",
      "properties": {
        "priority": 4000,
        "direction": "Inbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "*",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Default deny all inbound — explicit allow rules above"
      }
    },
    {
      "name": "Deny-All-Outbound",
      "properties": {
        "priority": 4000,
        "direction": "Outbound",
        "access": "Deny",
        "protocol": "*",
        "sourceAddressPrefix": "*",
        "sourcePortRange": "*",
        "destinationAddressPrefix": "*",
        "destinationPortRange": "*",
        "description": "Default deny all outbound — explicit allow rules above"
      }
    }
  ]
}`,
  },
};
