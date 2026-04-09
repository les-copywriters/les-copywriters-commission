DO $$
DECLARE
  new_id uuid;
  users_to_create TEXT[][] := ARRAY[
    ['juan@lescopywriters.fr',     'Closer@Juan1',     'Juan',     'closer'],
    ['eliott@lescopywriters.fr',   'Closer@Eliott1',   'Eliott',   'closer'],
    ['julian@lescopywriters.fr',   'Closer@Julian1',   'Julian',   'closer'],
    ['justin@lescopywriters.fr',   'Closer@Justin1',   'Justin',   'closer'],
    ['magda@lescopywriters.fr',    'Closer@Magda1',    'Magda',    'closer'],
    ['nicolas@lescopywriters.fr',  'Closer@Nicolas1',  'Nicolas',  'closer'],
    ['allessya@lescopywriters.fr', 'Setter@Allessya1', 'Allessya', 'setter']
  ];
BEGIN
  FOR i IN 1..array_length(users_to_create, 1) LOOP
    -- Reuse existing auth user if already created
    SELECT id INTO new_id FROM auth.users WHERE email = users_to_create[i][1];

    IF new_id IS NULL THEN
      new_id := gen_random_uuid();
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, confirmation_token, recovery_token)
      VALUES (new_id, '00000000-0000-0000-0000-000000000000', users_to_create[i][1], crypt(users_to_create[i][2], gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', '', '');
    END IF;

    -- Upsert profile (safe to re-run)
    INSERT INTO profiles (id, name, role)
    VALUES (new_id, users_to_create[i][3], users_to_create[i][4])
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;
  END LOOP;
END;
$$;
