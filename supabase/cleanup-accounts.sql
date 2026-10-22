-- =====================================================================
-- Remove accounts you didn't create. Deleting from auth.users also deletes
-- the profile and that person's messages (cascade).
-- =====================================================================

-- STEP 1: PREVIEW. Look at this list and make sure YOUR email is not in it.
select id, email, created_at, raw_user_meta_data ->> 'display_name' as display_name
from auth.users
where email <> 'YOUR_EMAIL_HERE'
order by created_at;

-- STEP 2: DELETE (uncomment after the preview looks right).
-- delete from auth.users where email <> 'YOUR_EMAIL_HERE';

-- Or remove only specific people:
-- delete from auth.users where email in ('a@example.com', 'b@example.com');

-- STEP 3: STOP FUTURE UNWANTED SIGNUPS. Change the invite code from the default:
-- update public.app_settings set value = 'A-NEW-SECRET-CODE' where key = 'invite_code';
-- Also: Supabase → Authentication → Sign In / Providers → turn off "Allow new users to sign up"
-- if you'd rather create members manually (Authentication → Users → Add user).
