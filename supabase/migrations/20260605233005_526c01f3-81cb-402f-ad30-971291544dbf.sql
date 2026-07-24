
UPDATE public.products SET image_url = CASE id
  WHEN 'ae79298a-ca72-4442-af43-ef4f2e137f9f'::uuid THEN 'https://images.unsplash.com/photo-1560847468-5eef72e2f1a6?w=600&h=450&fit=crop'
  WHEN '48cc2b40-4424-4cab-9381-87abdadf5467'::uuid THEN 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=600&h=450&fit=crop'
  WHEN '862ae2e9-f32a-4e0a-8d49-3394c504fcaf'::uuid THEN 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&h=450&fit=crop'
  WHEN '39d53250-5059-427e-93fc-15f0a693b7d6'::uuid THEN 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&h=450&fit=crop'
  WHEN '2a20a329-4ce2-48cf-b3f1-c82a2aeaaaec'::uuid THEN 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&h=450&fit=crop'
  WHEN 'ef72c279-26e0-4451-ada0-6aaf1877ba55'::uuid THEN 'https://images.unsplash.com/photo-1565299543923-37dd37887442?w=600&h=450&fit=crop'
  WHEN 'f7786a20-68bb-45d1-a840-61bb3101bf4a'::uuid THEN 'https://images.unsplash.com/photo-1571066811602-716837d681de?w=600&h=450&fit=crop'
  WHEN '37310534-a15d-4882-a951-d98eb62a6baa'::uuid THEN 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=450&fit=crop'
  WHEN '7132e00e-be71-4016-8a50-53e5f21a9eba'::uuid THEN 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&h=450&fit=crop'
  WHEN '388c9a65-6c00-45c5-bf79-a2b7ac1a5d16'::uuid THEN 'https://images.unsplash.com/photo-1593504049359-74330189a345?w=600&h=450&fit=crop'
  WHEN '609f8048-9c37-41f5-8c04-a5f4e812d41b'::uuid THEN 'https://images.unsplash.com/photo-1601924638867-3ec3a7b5d3bf?w=600&h=450&fit=crop'
  WHEN 'bbe4611e-c68d-42e3-b1d6-794b8cefd307'::uuid THEN 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=450&fit=crop'
  WHEN '9d8747e5-f4ad-4bea-aaf8-91e995db2e59'::uuid THEN 'https://images.unsplash.com/photo-1604917877934-07d8d248d396?w=600&h=450&fit=crop'
  WHEN '83f665b0-ca7c-4caa-9967-f082631c3d3e'::uuid THEN 'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=600&h=450&fit=crop'
  WHEN '0f1bc7ed-f6a5-4875-921a-fc69ddf3b12d'::uuid THEN 'https://images.unsplash.com/photo-1565657187555-845c5b2f50a6?w=600&h=450&fit=crop'
  WHEN '40b78628-bc2e-4333-8692-201f081c5d44'::uuid THEN 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=600&h=450&fit=crop'
  WHEN 'ff82a5b8-6c5a-4274-b9fd-b3a19e327fca'::uuid THEN 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=450&fit=crop'
  WHEN '1fc1ac7b-3f99-4878-afdc-fc9b916b354d'::uuid THEN 'https://images.unsplash.com/photo-1542587222-f9172e60c2d7?w=600&h=450&fit=crop'
  WHEN '4794ae09-dbf3-4898-a3b1-87eab2765d2f'::uuid THEN 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=450&fit=crop'
  WHEN '3c10e445-cbcc-47ab-a921-b4535f756d07'::uuid THEN 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=450&fit=crop'
END
WHERE restaurant_id = 'ec839f36-edbd-4ec0-82a2-b0f394ed05b7'::uuid;
