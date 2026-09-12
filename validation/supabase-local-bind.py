"""Pin only this disposable project's published ports to loopback.

CLI 2.117 / Docker Desktop can ignore the network's default binding when a
container is created before it joins that network. Preserve the exact container
configuration and volumes, changing only its network mode and host IP bindings.
"""
import http.client
import json
import os
import socket
import subprocess

docker = os.environ.get('DOCKER_BIN', 'docker')
def output(*args):
    return subprocess.check_output([docker, *args], text=True).strip()
context = json.loads(output('context', 'inspect'))[0]
host = context['Endpoints']['docker']['Host']
assert host.startswith('unix://'), 'A local Docker engine is required'
api_version = output('version', '--format', '{{.Server.APIVersion}}')

class Docker(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(host.removeprefix('unix://'))

def api(method, endpoint, body=None):
    connection = Docker('localhost')
    connection.request(method, '/v'+api_version+endpoint,
                       json.dumps(body) if body is not None else None,
                       {'Content-Type': 'application/json'})
    response = connection.getresponse()
    data = response.read()
    assert response.status < 300, f'Local Docker operation failed: {method} {response.status}'
    connection.close()
    return json.loads(data) if data else None

for service in ['db', 'kong', 'inbucket', 'studio']:
    name = 'supabase_'+service+'_momentum-cdc-validation'
    spec = api('GET', '/containers/'+name+'/json')
    assert list(spec['NetworkSettings']['Networks']) == ['momentum-cdc-local']
    ports = spec['NetworkSettings']['Ports']
    if all(item['HostIp'] == '127.0.0.1' for bindings in ports.values() if bindings for item in bindings):
        continue
    for bindings in spec['HostConfig']['PortBindings'].values():
        for binding in bindings:
            binding['HostIp'] = '127.0.0.1'
    endpoint = spec['NetworkSettings']['Networks']['momentum-cdc-local']
    config = {**spec['Config'], 'HostConfig': spec['HostConfig'], 'NetworkingConfig': {
        'EndpointsConfig': {'momentum-cdc-local': {'Aliases': endpoint['Aliases']}}}}
    config['HostConfig']['NetworkMode'] = 'momentum-cdc-local'
    backup = name+'-network-backup'
    api('POST', '/containers/'+name+'/stop?t=30')
    api('POST', '/containers/'+name+'/rename?name='+backup)
    try:
        api('POST', '/containers/create?name='+name, config)
        if service == 'kong':
            # CLI injects certificates into the writable layer rather than a volume.
            copied = subprocess.Popen([docker, 'cp', '-a', backup+':/home/kong/.', '-'], stdout=subprocess.PIPE)
            result = subprocess.run([docker, 'cp', '-a', '-', name+':/home/kong/'], stdin=copied.stdout)
            copied.stdout.close()
            assert copied.wait() == 0 and result.returncode == 0
        api('POST', '/containers/'+name+'/start')
    except Exception:
        # Preserve the stopped original for recovery; never remove its data volume.
        raise RuntimeError('Local port binding failed; original retained as '+backup) from None
    actual = api('GET', '/containers/'+name+'/json')['NetworkSettings']['Ports']
    assert all(item['HostIp'] == '127.0.0.1' for bindings in actual.values() if bindings for item in bindings)
    api('DELETE', '/containers/'+backup)
print('Local Supabase ports are restricted to 127.0.0.1.')
