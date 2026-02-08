INSERT INTO users (username, password, name, role)
VALUES
  ('maekawa', '$2b$10$K9oIoHcgYoz98Gg.UVQ2AO9Vnk57KPVQ2ekdDPC4392sslwXrUSVy', '前川', 'staff'),
  ('wada', '$2b$10$K9oIoHcgYoz98Gg.UVQ2AO9Vnk57KPVQ2ekdDPC4392sslwXrUSVy', '和田', 'staff'),
  ('nakayama', '$2b$10$K9oIoHcgYoz98Gg.UVQ2AO9Vnk57KPVQ2ekdDPC4392sslwXrUSVy', '中山', 'staff')
ON CONFLICT (username) DO NOTHING;
