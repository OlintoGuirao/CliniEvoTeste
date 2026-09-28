export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          id: string
          action: string
          entity_type: string
          entity_id: string | null
          details: Json | null
          admin_email: string
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          entity_type: string
          entity_id?: string | null
          details?: Json | null
          admin_email: string
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: Json | null
          admin_email?: string
          created_at?: string
        }
        Relationships: []
      }
      botox_applications: {
        Row: {
          application_date: string
          clinical_observations: string | null
          created_at: string
          id: string
          patient_id: string
          patient_satisfaction: number | null
          product_used: string | null
          professional_notes: string | null
          side_effects: string | null
          treated_areas: string[]
          units_applied: number | null
          updated_at: string
        }
        Insert: {
          application_date?: string
          clinical_observations?: string | null
          created_at?: string
          id?: string
          patient_id: string
          patient_satisfaction?: number | null
          product_used?: string | null
          professional_notes?: string | null
          side_effects?: string | null
          treated_areas?: string[]
          units_applied?: number | null
          updated_at?: string
        }
        Update: {
          application_date?: string
          clinical_observations?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          patient_satisfaction?: number | null
          product_used?: string | null
          professional_notes?: string | null
          side_effects?: string | null
          treated_areas?: string[]
          units_applied?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "botox_applications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_applications: {
        Row: {
          id: string
          patient_id: string
          treatment_type_id: string
          application_date: string
          data: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          treatment_type_id: string
          application_date?: string
          data?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          treatment_type_id?: string
          application_date?: string
          data?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_applications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_applications_treatment_type_id_fkey"
            columns: ["treatment_type_id"]
            isOneToOne: false
            referencedRelation: "treatment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_fields: {
        Row: {
          id: string
          procedure_id: string
          field_key: string
          label: string
          field_type: string
          options: Json
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          procedure_id: string
          field_key: string
          label: string
          field_type: string
          options?: Json
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          procedure_id?: string
          field_key?: string
          label?: string
          field_type?: string
          options?: Json
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_fields_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_instances: {
        Row: {
          id: string
          procedure_id: string
          patient_id: string
          professional_id: string
          data_inicio: string
          status: string
          observacoes_gerais: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          procedure_id: string
          patient_id: string
          professional_id: string
          data_inicio?: string
          status?: string
          observacoes_gerais?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          procedure_id?: string
          patient_id?: string
          professional_id?: string
          data_inicio?: string
          status?: string
          observacoes_gerais?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_instances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_instances_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_instances_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_photos: {
        Row: {
          id: string
          procedure_instance_id: string
          procedure_session_id: string | null
          photo_type: string
          file_url: string
          created_at: string
        }
        Insert: {
          id?: string
          procedure_instance_id: string
          procedure_session_id?: string | null
          photo_type: string
          file_url: string
          created_at?: string
        }
        Update: {
          id?: string
          procedure_instance_id?: string
          procedure_session_id?: string | null
          photo_type?: string
          file_url?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_photos_procedure_instance_id_fkey"
            columns: ["procedure_instance_id"]
            isOneToOne: false
            referencedRelation: "procedure_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_photos_procedure_session_id_fkey"
            columns: ["procedure_session_id"]
            isOneToOne: false
            referencedRelation: "procedure_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_pdf_links: {
        Row: {
          id: string
          slug: string
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          storage_path?: string
          created_at?: string
        }
        Relationships: []
      }
      emagrecimento_report_links: {
        Row: {
          id: string
          procedure_instance_id: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          procedure_instance_id: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          procedure_instance_id?: string
          slug?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'emagrecimento_report_links_procedure_instance_id_fkey'
            columns: ['procedure_instance_id']
            isOneToOne: true
            referencedRelation: 'procedure_instances'
            referencedColumns: ['id']
          },
        ]
      }
      procedure_report_links: {
        Row: {
          id: string
          procedure_instance_id: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          procedure_instance_id: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          procedure_instance_id?: string
          slug?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_report_links_procedure_instance_id_fkey"
            columns: ["procedure_instance_id"]
            isOneToOne: true
            referencedRelation: "procedure_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_results: {
        Row: {
          id: string
          procedure_instance_id: string
          procedure_session_id: string | null
          result_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          procedure_instance_id: string
          procedure_session_id?: string | null
          result_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          procedure_instance_id?: string
          procedure_session_id?: string | null
          result_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_results_procedure_instance_id_fkey"
            columns: ["procedure_instance_id"]
            isOneToOne: false
            referencedRelation: "procedure_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_results_procedure_session_id_fkey"
            columns: ["procedure_session_id"]
            isOneToOne: false
            referencedRelation: "procedure_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_sessions: {
        Row: {
          id: string
          procedure_instance_id: string
          patient_session_id: string | null
          session_date: string
          data: Json
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          procedure_instance_id: string
          patient_session_id?: string | null
          session_date?: string
          data?: Json
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          procedure_instance_id?: string
          patient_session_id?: string | null
          session_date?: string
          data?: Json
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_sessions_procedure_instance_id_fkey"
            columns: ["procedure_instance_id"]
            isOneToOne: false
            referencedRelation: "procedure_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_sessions_patient_session_id_fkey"
            columns: ["patient_session_id"]
            isOneToOne: false
            referencedRelation: "patient_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_sessions: {
        Row: {
          id: string
          patient_id: string
          professional_id: string
          session_date: string
          start_time: string | null
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          professional_id: string
          session_date?: string
          start_time?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          professional_id?: string
          session_date?: string
          start_time?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_sessions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_session_photos: {
        Row: {
          id: string
          patient_session_id: string
          file_url: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          patient_session_id: string
          file_url: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          patient_session_id?: string
          file_url?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_session_photos_patient_session_id_fkey"
            columns: ["patient_session_id"]
            isOneToOne: false
            referencedRelation: "patient_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          id: string
          slug: string
          version: number
          title: string
          body: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          version?: number
          title: string
          body: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          version?: number
          title?: string
          body?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      term_signatures: {
        Row: {
          id: string
          patient_id: string
          patient_session_id: string | null
          procedure_session_id: string | null
          term_id: string
          signature_data: string
          professional_signature_data: string | null
          signed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          patient_session_id?: string | null
          procedure_session_id?: string | null
          term_id: string
          signature_data: string
          professional_signature_data?: string | null
          signed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          patient_session_id?: string | null
          procedure_session_id?: string | null
          term_id?: string
          signature_data?: string
          professional_signature_data?: string | null
          signed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_signatures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_signatures_patient_session_id_fkey"
            columns: ["patient_session_id"]
            isOneToOne: false
            referencedRelation: "patient_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_signatures_procedure_session_id_fkey"
            columns: ["procedure_session_id"]
            isOneToOne: false
            referencedRelation: "procedure_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_signatures_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_anamnese: {
        Row: {
          id: string
          patient_id: string
          data: Record<string, unknown>
          signature_data: string | null
          signed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          data?: Record<string, unknown>
          signature_data?: string | null
          signed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          data?: Record<string, unknown>
          signature_data?: string | null
          signed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_anamnese_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_exams: {
        Row: {
          id: string
          patient_id: string
          professional_id: string
          exam_name: string
          exam_date: string | null
          file_url: string
          file_path: string
          mime_type: string | null
          extracted_text: string | null
          ai_summary: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          professional_id: string
          exam_name: string
          exam_date?: string | null
          file_url: string
          file_path: string
          mime_type?: string | null
          extracted_text?: string | null
          ai_summary?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          professional_id?: string
          exam_name?: string
          exam_date?: string | null
          file_url?: string
          file_path?: string
          mime_type?: string | null
          extracted_text?: string | null
          ai_summary?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_exams_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_exams_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      botox_reapplication_reminders: {
        Row: {
          id: string
          patient_id: string
          procedure_instance_id: string | null
          procedure_session_id: string | null
          professional_id: string
          due_date: string
          notified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          procedure_instance_id?: string | null
          procedure_session_id?: string | null
          professional_id: string
          due_date: string
          notified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          procedure_instance_id?: string | null
          procedure_session_id?: string | null
          professional_id?: string
          due_date?: string
          notified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "botox_reapplication_reminders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "botox_reapplication_reminders_procedure_instance_id_fkey"
            columns: ["procedure_instance_id"]
            isOneToOne: false
            referencedRelation: "procedure_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "botox_reapplication_reminders_procedure_session_id_fkey"
            columns: ["procedure_session_id"]
            isOneToOne: false
            referencedRelation: "procedure_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "botox_reapplication_reminders_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_quote_public_links: {
        Row: {
          id: string
          budget_quote_id: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          budget_quote_id: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          budget_quote_id?: string
          slug?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_quote_public_links_budget_quote_id_fkey'
            columns: ['budget_quote_id']
            isOneToOne: true
            referencedRelation: 'budget_quotes'
            referencedColumns: ['id']
          },
        ]
      }
      budget_quotes: {
        Row: {
          id: string
          professional_id: string
          patient_id: string
          title: string | null
          notes: string | null
          treatment_time: number | null
          treatment_time_unit: string | null
          status: string
          responded_at: string | null
          patient_payment_day: number | null
          patient_payment_method: string | null
          accepted_treatment_time: number | null
          accepted_treatment_time_unit: string | null
          schedule_start_month: string | null
          lines: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          patient_id: string
          title?: string | null
          notes?: string | null
          treatment_time?: number | null
          treatment_time_unit?: string | null
          status?: string
          responded_at?: string | null
          patient_payment_day?: number | null
          patient_payment_method?: string | null
          accepted_treatment_time?: number | null
          accepted_treatment_time_unit?: string | null
          schedule_start_month?: string | null
          lines?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          patient_id?: string
          title?: string | null
          notes?: string | null
          treatment_time?: number | null
          treatment_time_unit?: string | null
          status?: string
          responded_at?: string | null
          patient_payment_day?: number | null
          patient_payment_method?: string | null
          accepted_treatment_time?: number | null
          accepted_treatment_time_unit?: string | null
          schedule_start_month?: string | null
          lines?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_quotes_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'budget_quotes_professional_id_fkey'
            columns: ['professional_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      budget_quote_payments: {
        Row: {
          id: string
          budget_quote_id: string
          mes_referencia: string
          valor: number
          data_pagamento: string | null
          created_at: string
        }
        Insert: {
          id?: string
          budget_quote_id: string
          mes_referencia: string
          valor: number
          data_pagamento?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          budget_quote_id?: string
          mes_referencia?: string
          valor?: number
          data_pagamento?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_quote_payments_budget_quote_id_fkey'
            columns: ['budget_quote_id']
            isOneToOne: false
            referencedRelation: 'budget_quotes'
            referencedColumns: ['id']
          },
        ]
      }
      profile_procedure_permissions: {
        Row: {
          id: string
          profile_id: string
          procedure_id: string
          visible: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          procedure_id: string
          visible?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          procedure_id?: string
          visible?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_procedure_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_procedure_permissions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          id: string
          is_global: boolean
          created_by: string | null
          category: string
          specialty: string | null
          name: string
          description: string | null
          slug: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_global?: boolean
          created_by?: string | null
          category: string
          specialty?: string | null
          name: string
          description?: string | null
          slug: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_global?: boolean
          created_by?: string | null
          category?: string
          specialty?: string | null
          name?: string
          description?: string | null
          slug?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_procedures: {
        Row: {
          user_id: string
          procedure_id: string
          is_active: boolean
          show_in_menu: boolean
          show_in_appointments: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          procedure_id: string
          is_active?: boolean
          show_in_menu?: boolean
          show_in_appointments?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          procedure_id?: string
          is_active?: boolean
          show_in_menu?: boolean
          show_in_appointments?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_procedures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_consents: {
        Row: {
          consent_date: string | null
          consent_given: boolean
          consent_text: string | null
          created_at: string
          id: string
          ip_address: string | null
          patient_id: string
          signature_data: string | null
          updated_at: string
        }
        Insert: {
          consent_date?: string | null
          consent_given?: boolean
          consent_text?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id: string
          signature_data?: string | null
          updated_at?: string
        }
        Update: {
          consent_date?: string | null
          consent_given?: boolean
          consent_text?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id?: string
          signature_data?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_photos: {
        Row: {
          botox_application_id: string | null
          created_at: string
          description: string | null
          file_url: string
          id: string
          patient_id: string
          photo_type: string
          taken_at: string | null
          weight_loss_session_id: string | null
        }
        Insert: {
          botox_application_id?: string | null
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          patient_id: string
          photo_type: string
          taken_at?: string | null
          weight_loss_session_id?: string | null
        }
        Update: {
          botox_application_id?: string | null
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          patient_id?: string
          photo_type?: string
          taken_at?: string | null
          weight_loss_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_photos_botox_application_id_fkey"
            columns: ["botox_application_id"]
            isOneToOne: false
            referencedRelation: "botox_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_photos_weight_loss_session_id_fkey"
            columns: ["weight_loss_session_id"]
            isOneToOne: false
            referencedRelation: "weight_loss_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_patient_origins: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_patient_origins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_record_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_record_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          address_number: string | null
          city: string | null
          consultation_objective: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          general_notes: string | null
          id: string
          neighborhood: string | null
          nickname: string | null
          phone: string | null
          profession: string | null
          professional_id: string
          profile_photo_url: string | null
          referred_by: string | null
          registration_completed_at: string | null
          sex: Database["public"]["Enums"]["patient_sex"] | null
          treatment_start_date: string | null
          treatment_type_id: string | null
          updated_at: string
          zip_code: string | null
          origin_id: string | null
          referred_by_patient_id: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          consultation_objective?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          general_notes?: string | null
          id?: string
          neighborhood?: string | null
          nickname?: string | null
          phone?: string | null
          profession?: string | null
          professional_id: string
          profile_photo_url?: string | null
          referred_by?: string | null
          registration_completed_at?: string | null
          sex?: Database["public"]["Enums"]["patient_sex"] | null
          treatment_start_date?: string | null
          treatment_type_id?: string | null
          updated_at?: string
          zip_code?: string | null
          origin_id?: string | null
          referred_by_patient_id?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          consultation_objective?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          general_notes?: string | null
          id?: string
          neighborhood?: string | null
          nickname?: string | null
          phone?: string | null
          profession?: string | null
          professional_id?: string
          profile_photo_url?: string | null
          referred_by?: string | null
          registration_completed_at?: string | null
          sex?: Database["public"]["Enums"]["patient_sex"] | null
          treatment_start_date?: string | null
          treatment_type_id?: string | null
          updated_at?: string
          zip_code?: string | null
          origin_id?: string | null
          referred_by_patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "clinic_patient_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_referred_by_patient_id_fkey"
            columns: ["referred_by_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_treatment_type_id_fkey"
            columns: ["treatment_type_id"]
            isOneToOne: false
            referencedRelation: "treatment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_record_types: {
        Row: {
          created_at: string
          patient_id: string
          record_type_id: string
        }
        Insert: {
          created_at?: string
          patient_id: string
          record_type_id: string
        }
        Update: {
          created_at?: string
          patient_id?: string
          record_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_record_types_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_record_types_record_type_id_fkey"
            columns: ["record_type_id"]
            isOneToOne: false
            referencedRelation: "clinic_record_types"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_types: {
        Row: {
          id: string
          professional_id: string
          name: string
          subtitle: string | null
          field_definitions: Json | null
          applications_table: string | null
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          name: string
          subtitle?: string | null
          field_definitions?: Json | null
          applications_table?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          name?: string
          subtitle?: string | null
          field_definitions?: Json | null
          applications_table?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_types_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          id: string
          professional_id: string
          patient_id: string | null
          full_name: string | null
          pre_registration_phone: string | null
          appointment_date: string
          start_time: string
          notes: string | null
          is_encaixe: boolean
          appointment_block_id: string | null
          is_block_start: boolean
          created_at: string
          updated_at: string
          clinic_status: string
        }
        Insert: {
          id?: string
          professional_id: string
          patient_id?: string | null
          full_name?: string | null
          pre_registration_phone?: string | null
          appointment_date: string
          start_time: string
          notes?: string | null
          is_encaixe?: boolean
          appointment_block_id?: string | null
          is_block_start?: boolean
          created_at?: string
          updated_at?: string
          clinic_status?: string
        }
        Update: {
          id?: string
          professional_id?: string
          patient_id?: string | null
          full_name?: string | null
          pre_registration_phone?: string | null
          appointment_date?: string
          start_time?: string
          notes?: string | null
          is_encaixe?: boolean
          appointment_block_id?: string | null
          is_block_start?: boolean
          created_at?: string
          updated_at?: string
          clinic_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_entradas_nf: {
        Row: {
          id: string
          professional_id: string
          nome_produto: string
          quantidade: number
          valor_total: number
          descricao: string | null
          foto_url: string | null
          foto_path: string | null
          data_compra: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          nome_produto: string
          quantidade: number
          valor_total: number
          descricao?: string | null
          foto_url?: string | null
          foto_path?: string | null
          data_compra?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          nome_produto?: string
          quantidade?: number
          valor_total?: number
          descricao?: string | null
          foto_url?: string | null
          foto_path?: string | null
          data_compra?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'insumo_entradas_nf_professional_id_fkey'
            columns: ['professional_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      recebimentos: {
        Row: {
          id: string
          cliente_id: string
          profissional_id: string
          procedimento_id: string | null
          salon_procedure_id: string | null
          patient_session_id: string | null
          valor_total: number
          valor_recebido: number
          forma_pagamento: string
          parcelas: number | null
          status: string
          data: string
          created_at: string
          branch_id: string | null
          price_tier: string | null
        }
        Insert: {
          id?: string
          cliente_id: string
          profissional_id: string
          procedimento_id?: string | null
          salon_procedure_id?: string | null
          patient_session_id?: string | null
          valor_total: number
          valor_recebido?: number
          forma_pagamento: string
          parcelas?: number | null
          status: string
          data?: string
          created_at?: string
          branch_id?: string | null
          price_tier?: string | null
        }
        Update: {
          id?: string
          cliente_id?: string
          profissional_id?: string
          procedimento_id?: string | null
          salon_procedure_id?: string | null
          patient_session_id?: string | null
          valor_total?: number
          valor_recebido?: number
          forma_pagamento?: string
          parcelas?: number | null
          status?: string
          data?: string
          created_at?: string
          branch_id?: string | null
          price_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_salon_procedure_id_fkey"
            columns: ["salon_procedure_id"]
            isOneToOne: false
            referencedRelation: "salon_procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_patient_session_id_fkey"
            columns: ["patient_session_id"]
            isOneToOne: false
            referencedRelation: "patient_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          date_of_birth: string | null
          default_signature_data: string | null
          disabled_modules: string[]
          email: string
          full_name: string | null
          id: string
          is_blocked: boolean
          phone: string | null
          professional_registry_body: string | null
          professional_registry_number: string | null
          professional_specialty: string | null
          professional_stamp_data: string | null
          theme: 'dark' | 'light' | 'system' | null
          theme_palette: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          date_of_birth?: string | null
          default_signature_data?: string | null
          disabled_modules?: string[]
          email: string
          full_name?: string | null
          id: string
          is_blocked?: boolean
          phone?: string | null
          professional_registry_body?: string | null
          professional_registry_number?: string | null
          professional_specialty?: string | null
          professional_stamp_data?: string | null
          theme?: 'dark' | 'light' | 'system' | null
          theme_palette?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          date_of_birth?: string | null
          default_signature_data?: string | null
          disabled_modules?: string[]
          email?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          professional_registry_body?: string | null
          professional_registry_number?: string | null
          professional_specialty?: string | null
          professional_stamp_data?: string | null
          theme?: 'dark' | 'light' | 'system' | null
          theme_palette?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weight_loss_programs: {
        Row: {
          created_at: string
          height: number | null
          id: string
          initial_abdomen: number | null
          initial_arm: number | null
          initial_hip: number | null
          initial_thigh: number | null
          initial_waist: number | null
          initial_weight: number | null
          notes: string | null
          patient_id: string
          protocol_type: Database["public"]["Enums"]["protocol_type"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          initial_abdomen?: number | null
          initial_arm?: number | null
          initial_hip?: number | null
          initial_thigh?: number | null
          initial_waist?: number | null
          initial_weight?: number | null
          notes?: string | null
          patient_id: string
          protocol_type?: Database["public"]["Enums"]["protocol_type"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          initial_abdomen?: number | null
          initial_arm?: number | null
          initial_hip?: number | null
          initial_thigh?: number | null
          initial_waist?: number | null
          initial_weight?: number | null
          notes?: string | null
          patient_id?: string
          protocol_type?: Database["public"]["Enums"]["protocol_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_loss_programs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_loss_sessions: {
        Row: {
          abdomen: number | null
          arm: number | null
          body_fat_percentage: number | null
          created_at: string
          current_weight: number | null
          hip: number | null
          id: string
          patient_feedback: string | null
          professional_notes: string | null
          program_id: string
          session_date: string
          thigh: number | null
          updated_at: string
          waist: number | null
        }
        Insert: {
          abdomen?: number | null
          arm?: number | null
          body_fat_percentage?: number | null
          created_at?: string
          current_weight?: number | null
          hip?: number | null
          id?: string
          patient_feedback?: string | null
          professional_notes?: string | null
          program_id: string
          session_date?: string
          thigh?: number | null
          updated_at?: string
          waist?: number | null
        }
        Update: {
          abdomen?: number | null
          arm?: number | null
          body_fat_percentage?: number | null
          created_at?: string
          current_weight?: number | null
          hip?: number | null
          id?: string
          patient_feedback?: string | null
          professional_notes?: string | null
          program_id?: string
          session_date?: string
          thigh?: number | null
          updated_at?: string
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_loss_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "weight_loss_programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_bmi: {
        Args: { _height: number; _weight: number }
        Returns: number
      }
      has_lgpd_consent: { Args: { _patient_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_patient_owner: { Args: { _patient_id: string }; Returns: boolean }
      get_public_emagrecimento_report: { Args: { p_slug: string }; Returns: Json }
      ensure_emagrecimento_report_link: { Args: { p_procedure_instance_id: string }; Returns: string }
      get_public_procedure_report: { Args: { p_slug: string }; Returns: Json }
      ensure_procedure_report_link: { Args: { p_procedure_instance_id: string }; Returns: string }
      ensure_budget_quote_public_link: { Args: { p_budget_quote_id: string }; Returns: string }
      get_public_budget_quote: { Args: { p_slug: string }; Returns: Json }
      public_reject_budget_quote: { Args: { p_slug: string }; Returns: Json }
      public_accept_budget_quote: {
        Args: {
          p_slug: string
          p_payment_day: number
          p_payment_method: string
          p_treatment_time: number
          p_treatment_time_unit: string
        }
        Returns: Json
      }
      get_admin_stats: { Args: Record<PropertyKey, never>; Returns: Json }
      get_procedures_for_profile: { Args: { p_profile_id: string }; Returns: Database['public']['Tables']['procedures']['Row'][] }
    }
    Enums: {
      app_role: "admin" | "professional"
      patient_sex: "male" | "female" | "other"
      protocol_type: "diet" | "training" | "aesthetic" | "combined"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "professional"],
      patient_sex: ["male", "female", "other"],
      protocol_type: ["diet", "training", "aesthetic", "combined"],
    },
  },
} as const
