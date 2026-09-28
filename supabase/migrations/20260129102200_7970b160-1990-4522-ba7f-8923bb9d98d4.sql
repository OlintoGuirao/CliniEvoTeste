-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'professional');

-- Enum para sexo do paciente
CREATE TYPE public.patient_sex AS ENUM ('male', 'female', 'other');

-- Enum para tipo de protocolo de emagrecimento
CREATE TYPE public.protocol_type AS ENUM ('diet', 'training', 'aesthetic', 'combined');

-- Tabela de roles de usuários (separada para segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Tabela de perfis de profissionais
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pacientes
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    sex patient_sex,
    phone TEXT,
    email TEXT,
    profile_photo_url TEXT,
    treatment_start_date DATE DEFAULT CURRENT_DATE,
    general_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de consentimentos LGPD
CREATE TABLE public.lgpd_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_date TIMESTAMP WITH TIME ZONE,
    consent_text TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (patient_id)
);

-- Tabela de programas de emagrecimento
CREATE TABLE public.weight_loss_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    initial_weight DECIMAL(5,2),
    height DECIMAL(4,2),
    initial_waist DECIMAL(5,2),
    initial_abdomen DECIMAL(5,2),
    initial_hip DECIMAL(5,2),
    initial_thigh DECIMAL(5,2),
    initial_arm DECIMAL(5,2),
    protocol_type protocol_type DEFAULT 'combined',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de sessões de emagrecimento
CREATE TABLE public.weight_loss_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.weight_loss_programs(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_weight DECIMAL(5,2),
    waist DECIMAL(5,2),
    abdomen DECIMAL(5,2),
    hip DECIMAL(5,2),
    thigh DECIMAL(5,2),
    arm DECIMAL(5,2),
    body_fat_percentage DECIMAL(4,2),
    professional_notes TEXT,
    patient_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de aplicações de botox/rejuvenescimento
CREATE TABLE public.botox_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    treated_areas TEXT[] NOT NULL DEFAULT '{}',
    product_used TEXT,
    units_applied DECIMAL(5,2),
    professional_notes TEXT,
    clinical_observations TEXT,
    side_effects TEXT,
    patient_satisfaction INTEGER CHECK (patient_satisfaction >= 1 AND patient_satisfaction <= 5),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de fotos de pacientes
CREATE TABLE public.patient_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    weight_loss_session_id UUID REFERENCES public.weight_loss_sessions(id) ON DELETE SET NULL,
    botox_application_id UUID REFERENCES public.botox_applications(id) ON DELETE SET NULL,
    photo_type TEXT NOT NULL, -- 'front', 'side', 'back', 'before', 'immediate', '7days', '15days', '30days', 'profile'
    file_url TEXT NOT NULL,
    description TEXT,
    taken_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Função para verificar se usuário tem uma role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se profissional é dono do paciente
CREATE OR REPLACE FUNCTION public.is_patient_owner(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = _patient_id
      AND professional_id = auth.uid()
  )
$$;

-- Função para verificar consentimento LGPD
CREATE OR REPLACE FUNCTION public.has_lgpd_consent(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT consent_given 
     FROM public.lgpd_consents 
     WHERE patient_id = _patient_id),
    false
  )
$$;

-- Função para calcular IMC
CREATE OR REPLACE FUNCTION public.calculate_bmi(_weight DECIMAL, _height DECIMAL)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN _height > 0 THEN ROUND(_weight / (_height * _height), 2)
    ELSE NULL
  END
$$;

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lgpd_consents_updated_at
    BEFORE UPDATE ON public.lgpd_consents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weight_loss_programs_updated_at
    BEFORE UPDATE ON public.weight_loss_programs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weight_loss_sessions_updated_at
    BEFORE UPDATE ON public.weight_loss_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_botox_applications_updated_at
    BEFORE UPDATE ON public.botox_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    -- Adiciona role de profissional por padrão
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'professional');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS em todas as tabelas
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_loss_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_loss_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botox_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies para user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policies para profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- RLS Policies para patients
CREATE POLICY "Professionals can view their own patients"
    ON public.patients FOR SELECT
    USING (professional_id = auth.uid());

CREATE POLICY "Professionals can insert their own patients"
    ON public.patients FOR INSERT
    WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can update their own patients"
    ON public.patients FOR UPDATE
    USING (professional_id = auth.uid());

CREATE POLICY "Professionals can delete their own patients"
    ON public.patients FOR DELETE
    USING (professional_id = auth.uid());

-- RLS Policies para lgpd_consents
CREATE POLICY "Professionals can view consents of their patients"
    ON public.lgpd_consents FOR SELECT
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can insert consents for their patients"
    ON public.lgpd_consents FOR INSERT
    WITH CHECK (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can update consents of their patients"
    ON public.lgpd_consents FOR UPDATE
    USING (public.is_patient_owner(patient_id));

-- RLS Policies para weight_loss_programs
CREATE POLICY "Professionals can view programs of their patients"
    ON public.weight_loss_programs FOR SELECT
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can insert programs for their patients"
    ON public.weight_loss_programs FOR INSERT
    WITH CHECK (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can update programs of their patients"
    ON public.weight_loss_programs FOR UPDATE
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can delete programs of their patients"
    ON public.weight_loss_programs FOR DELETE
    USING (public.is_patient_owner(patient_id));

-- RLS Policies para weight_loss_sessions
CREATE POLICY "Professionals can view sessions of their patients"
    ON public.weight_loss_sessions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.weight_loss_programs wlp
        JOIN public.patients p ON p.id = wlp.patient_id
        WHERE wlp.id = weight_loss_sessions.program_id
        AND p.professional_id = auth.uid()
    ));

CREATE POLICY "Professionals can insert sessions for their patients"
    ON public.weight_loss_sessions FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.weight_loss_programs wlp
        JOIN public.patients p ON p.id = wlp.patient_id
        WHERE wlp.id = weight_loss_sessions.program_id
        AND p.professional_id = auth.uid()
    ));

CREATE POLICY "Professionals can update sessions of their patients"
    ON public.weight_loss_sessions FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.weight_loss_programs wlp
        JOIN public.patients p ON p.id = wlp.patient_id
        WHERE wlp.id = weight_loss_sessions.program_id
        AND p.professional_id = auth.uid()
    ));

CREATE POLICY "Professionals can delete sessions of their patients"
    ON public.weight_loss_sessions FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.weight_loss_programs wlp
        JOIN public.patients p ON p.id = wlp.patient_id
        WHERE wlp.id = weight_loss_sessions.program_id
        AND p.professional_id = auth.uid()
    ));

-- RLS Policies para botox_applications
CREATE POLICY "Professionals can view botox applications of their patients"
    ON public.botox_applications FOR SELECT
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can insert botox applications for their patients"
    ON public.botox_applications FOR INSERT
    WITH CHECK (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can update botox applications of their patients"
    ON public.botox_applications FOR UPDATE
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can delete botox applications of their patients"
    ON public.botox_applications FOR DELETE
    USING (public.is_patient_owner(patient_id));

-- RLS Policies para patient_photos
CREATE POLICY "Professionals can view photos of their patients with consent"
    ON public.patient_photos FOR SELECT
    USING (public.is_patient_owner(patient_id) AND public.has_lgpd_consent(patient_id));

CREATE POLICY "Professionals can insert photos for their patients"
    ON public.patient_photos FOR INSERT
    WITH CHECK (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can update photos of their patients"
    ON public.patient_photos FOR UPDATE
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can delete photos of their patients"
    ON public.patient_photos FOR DELETE
    USING (public.is_patient_owner(patient_id));

-- Criar bucket para fotos de pacientes
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para patient-photos bucket
CREATE POLICY "Authenticated users can upload photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'patient-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view their photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'patient-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can update their photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'patient-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'patient-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Índices para performance
CREATE INDEX idx_patients_professional_id ON public.patients(professional_id);
CREATE INDEX idx_weight_loss_programs_patient_id ON public.weight_loss_programs(patient_id);
CREATE INDEX idx_weight_loss_sessions_program_id ON public.weight_loss_sessions(program_id);
CREATE INDEX idx_botox_applications_patient_id ON public.botox_applications(patient_id);
CREATE INDEX idx_patient_photos_patient_id ON public.patient_photos(patient_id);
CREATE INDEX idx_lgpd_consents_patient_id ON public.lgpd_consents(patient_id);