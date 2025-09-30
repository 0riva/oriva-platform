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
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agreement_participants: {
        Row: {
          agreed_at: string | null
          agreement_id: string
          created_at: string | null
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          agreed_at?: string | null
          agreement_id: string
          created_at?: string | null
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          agreed_at?: string | null
          agreement_id?: string
          created_at?: string | null
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_participants_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          collection_id: string | null
          content: Json
          created_at: string | null
          created_by: string | null
          entry_id: string | null
          id: string
          profile_id: string | null
          status: Database["public"]["Enums"]["agreement_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          collection_id?: string | null
          content: Json
          created_at?: string | null
          created_by?: string | null
          entry_id?: string | null
          id?: string
          profile_id?: string | null
          status?: Database["public"]["Enums"]["agreement_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          collection_id?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          entry_id?: string | null
          id?: string
          profile_id?: string | null
          status?: Database["public"]["Enums"]["agreement_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "agreements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_api_usage: {
        Row: {
          app_id: string
          created_at: string | null
          endpoint: string | null
          id: string
          method: string | null
          response_time_ms: number | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          app_id: string
          created_at?: string | null
          endpoint?: string | null
          id?: string
          method?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string | null
          endpoint?: string | null
          id?: string
          method?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_api_usage_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_oauth_credentials: {
        Row: {
          app_id: string
          client_id: string
          client_secret: string
          created_at: string | null
          id: string
        }
        Insert: {
          app_id: string
          client_id: string
          client_secret: string
          created_at?: string | null
          id?: string
        }
        Update: {
          app_id?: string
          client_id?: string
          client_secret?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_oauth_credentials_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_reviews: {
        Row: {
          app_id: string
          created_at: string | null
          id: string
          rating: number | null
          review_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string | null
          id?: string
          rating?: number | null
          review_text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string | null
          id?: string
          rating?: number | null
          review_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_reviews_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audiences: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          type: Database["public"]["Enums"]["audience_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          type: Database["public"]["Enums"]["audience_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          type?: Database["public"]["Enums"]["audience_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string | null
          days: string[]
          description: string | null
          end_time: string
          group_restrictions: string[] | null
          id: string
          is_recurring: boolean | null
          max_participants: number | null
          recurring_pattern: string | null
          session_duration: string
          start_time: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          days: string[]
          description?: string | null
          end_time: string
          group_restrictions?: string[] | null
          id?: string
          is_recurring?: boolean | null
          max_participants?: number | null
          recurring_pattern?: string | null
          session_duration: string
          start_time: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          days?: string[]
          description?: string | null
          end_time?: string
          group_restrictions?: string[] | null
          id?: string
          is_recurring?: boolean | null
          max_participants?: number | null
          recurring_pattern?: string | null
          session_duration?: string
          start_time?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chemistry_ratings: {
        Row: {
          created_at: string | null
          id: string
          rated_user_id: string
          rater_user_id: string
          rating: number
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          rated_user_id: string
          rater_user_id: string
          rating: number
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          rated_user_id?: string
          rater_user_id?: string
          rating?: number
          session_id?: string | null
        }
        Relationships: []
      }
      content_collections: {
        Row: {
          audience: Json | null
          collection_type: string | null
          created_at: string | null
          description: string | null
          entry_count: number | null
          id: string
          parsing_metadata: Json | null
          profile_id: string | null
          published_at: string | null
          source_content: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          view_count: number | null
        }
        Insert: {
          audience?: Json | null
          collection_type?: string | null
          created_at?: string | null
          description?: string | null
          entry_count?: number | null
          id?: string
          parsing_metadata?: Json | null
          profile_id?: string | null
          published_at?: string | null
          source_content?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
        }
        Update: {
          audience?: Json | null
          collection_type?: string | null
          created_at?: string | null
          description?: string | null
          entry_count?: number | null
          id?: string
          parsing_metadata?: Json | null
          profile_id?: string | null
          published_at?: string | null
          source_content?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      context_interactions: {
        Row: {
          completed_at: string | null
          context: string
          created_at: string | null
          data: Json | null
          id: string
          metadata: Json | null
          scheduled_at: string | null
          status: string | null
          target_user_id: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context: string
          created_at?: string | null
          data?: Json | null
          id?: string
          metadata?: Json | null
          scheduled_at?: string | null
          status?: string | null
          target_user_id?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          metadata?: Json | null
          scheduled_at?: string | null
          status?: string | null
          target_user_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      context_settings: {
        Row: {
          context: string
          created_at: string | null
          data_type: string | null
          description: string | null
          id: string
          is_user_configurable: boolean | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          context: string
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          is_user_configurable?: boolean | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          context?: string
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          is_user_configurable?: boolean | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      developer_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[]
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[]
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      developers: {
        Row: {
          api_key: string | null
          company_name: string | null
          created_at: string
          hashed_api_key: string | null
          id: string
          name: string | null
          status: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          api_key?: string | null
          company_name?: string | null
          created_at?: string
          hashed_api_key?: string | null
          id?: string
          name?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          api_key?: string | null
          company_name?: string | null
          created_at?: string
          hashed_api_key?: string | null
          id?: string
          name?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      entries: {
        Row: {
          audience: Json | null
          auto_saved: boolean | null
          collection_id: string | null
          combined_embedding: string | null
          content: Json
          content_embedding: string | null
          created_at: string | null
          created_by: string | null
          creation_method: string | null
          display_order: number | null
          embedding_model: string | null
          embedding_updated_at: string | null
          estimated_read_time: number | null
          has_tasks: boolean | null
          heading_level: number | null
          id: string
          is_anonymous: boolean
          media: Json | null
          parent_id: string | null
          phase_number: number | null
          profile_id: string | null
          response_count: Json | null
          sections: Json | null
          status: Database["public"]["Enums"]["entry_status"] | null
          task_count: number | null
          telescope_collection_id: string | null
          template: Json | null
          template_id: string | null
          title: string
          title_embedding: string | null
          topics: string[] | null
          updated_at: string | null
          user_id: string | null
          word_count: number | null
        }
        Insert: {
          audience?: Json | null
          auto_saved?: boolean | null
          collection_id?: string | null
          combined_embedding?: string | null
          content?: Json
          content_embedding?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_method?: string | null
          display_order?: number | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          estimated_read_time?: number | null
          has_tasks?: boolean | null
          heading_level?: number | null
          id?: string
          is_anonymous?: boolean
          media?: Json | null
          parent_id?: string | null
          phase_number?: number | null
          profile_id?: string | null
          response_count?: Json | null
          sections?: Json | null
          status?: Database["public"]["Enums"]["entry_status"] | null
          task_count?: number | null
          telescope_collection_id?: string | null
          template?: Json | null
          template_id?: string | null
          title: string
          title_embedding?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          word_count?: number | null
        }
        Update: {
          audience?: Json | null
          auto_saved?: boolean | null
          collection_id?: string | null
          combined_embedding?: string | null
          content?: Json
          content_embedding?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_method?: string | null
          display_order?: number | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          estimated_read_time?: number | null
          has_tasks?: boolean | null
          heading_level?: number | null
          id?: string
          is_anonymous?: boolean
          media?: Json | null
          parent_id?: string | null
          phase_number?: number | null
          profile_id?: string | null
          response_count?: Json | null
          sections?: Json | null
          status?: Database["public"]["Enums"]["entry_status"] | null
          task_count?: number | null
          telescope_collection_id?: string | null
          template?: Json | null
          template_id?: string | null
          title?: string
          title_embedding?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_telescope_collection_id_fkey"
            columns: ["telescope_collection_id"]
            isOneToOne: false
            referencedRelation: "content_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_relationships: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          relationship_type: string | null
          source_entry_id: string
          target_entry_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          relationship_type?: string | null
          source_entry_id: string
          target_entry_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          relationship_type?: string | null
          source_entry_id?: string
          target_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_relationships_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_relationships_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_relationships_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_relationships_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      entry_topics: {
        Row: {
          created_at: string
          entry_id: string
          topic_slug: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          topic_slug: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          topic_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_topics_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_topics_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      favorites: {
        Row: {
          agreement_id: string | null
          created_at: string | null
          entry_id: string | null
          id: string
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          agreement_id?: string | null
          created_at?: string | null
          entry_id?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          agreement_id?: string | null
          created_at?: string | null
          entry_id?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_items: {
        Row: {
          created_at: string | null
          expires_at: string | null
          feed_position: number | null
          id: string
          relevance_score: number
          response_id: string | null
          source_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          feed_position?: number | null
          id?: string
          relevance_score?: number
          response_id?: string | null
          source_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          feed_position?: number | null
          id?: string
          relevance_score?: number
          response_id?: string | null
          source_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_items_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "section_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invited_by: string | null
          joined_at: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_private: boolean | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      groups_new: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_private: boolean | null
          members: Json
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          members?: Json
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          members?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      hugo_analysis_results: {
        Row: {
          analysis_data: Json
          analysis_depth: string | null
          analysis_type: string
          created_at: string | null
          id: string
          processing_time: number | null
          user_id: string
        }
        Insert: {
          analysis_data: Json
          analysis_depth?: string | null
          analysis_type: string
          created_at?: string | null
          id?: string
          processing_time?: number | null
          user_id: string
        }
        Update: {
          analysis_data?: Json
          analysis_depth?: string | null
          analysis_type?: string
          created_at?: string | null
          id?: string
          processing_time?: number | null
          user_id?: string
        }
        Relationships: []
      }
      hugo_collaboration_memory: {
        Row: {
          app_id: string
          content: Json
          content_embedding: string | null
          context_type: string
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          privacy_level: string | null
          shared_with_core: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_id: string
          content: Json
          content_embedding?: string | null
          context_type: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          privacy_level?: string | null
          shared_with_core?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_id?: string
          content?: Json
          content_embedding?: string | null
          context_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          privacy_level?: string | null
          shared_with_core?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hugo_knowledge_base: {
        Row: {
          category: string
          confidence_score: number | null
          content_embedding: string | null
          context: string
          created_at: string | null
          id: string
          input: Json
          is_active: boolean | null
          language: string | null
          last_used_at: string | null
          output: string
          source: string | null
          success_rate: number | null
          tags: string[] | null
          updated_at: string | null
          usage_count: number | null
          version: number | null
        }
        Insert: {
          category: string
          confidence_score?: number | null
          content_embedding?: string | null
          context: string
          created_at?: string | null
          id?: string
          input: Json
          is_active?: boolean | null
          language?: string | null
          last_used_at?: string | null
          output: string
          source?: string | null
          success_rate?: number | null
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
          version?: number | null
        }
        Update: {
          category?: string
          confidence_score?: number | null
          content_embedding?: string | null
          context?: string
          created_at?: string | null
          id?: string
          input?: Json
          is_active?: boolean | null
          language?: string | null
          last_used_at?: string | null
          output?: string
          source?: string | null
          success_rate?: number | null
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
          version?: number | null
        }
        Relationships: []
      }
      hugo_learning_data: {
        Row: {
          confidence: number | null
          created_at: string | null
          domain: string
          feedback_data: Json | null
          id: string
          interaction_data: Json
          model_version: string | null
          outcome_data: Json | null
          processing_time: number | null
          session_id: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          domain: string
          feedback_data?: Json | null
          id?: string
          interaction_data: Json
          model_version?: string | null
          outcome_data?: Json | null
          processing_time?: number | null
          session_id: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          domain?: string
          feedback_data?: Json | null
          id?: string
          interaction_data?: Json
          model_version?: string | null
          outcome_data?: Json | null
          processing_time?: number | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      hugo_user_insights: {
        Row: {
          created_at: string | null
          description: string
          domain: string
          estimated_impact: string | null
          evidence: Json | null
          expires_at: string | null
          id: string
          insight_type: string
          metadata: Json | null
          priority: string | null
          significance: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          domain: string
          estimated_impact?: string | null
          evidence?: Json | null
          expires_at?: string | null
          id?: string
          insight_type: string
          metadata?: Json | null
          priority?: string | null
          significance?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          domain?: string
          estimated_impact?: string | null
          evidence?: Json | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          metadata?: Json | null
          priority?: string | null
          significance?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      hugo_user_profiles: {
        Row: {
          cognitive_profile: Json | null
          core_values: Json | null
          created_at: string | null
          data_sharing_consent: Json | null
          fears: Json | null
          life_goals: Json | null
          life_lessons: Json | null
          lifestyle_preferences: Json | null
          skill_set: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cognitive_profile?: Json | null
          core_values?: Json | null
          created_at?: string | null
          data_sharing_consent?: Json | null
          fears?: Json | null
          life_goals?: Json | null
          life_lessons?: Json | null
          lifestyle_preferences?: Json | null
          skill_set?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cognitive_profile?: Json | null
          core_values?: Json | null
          created_at?: string | null
          data_sharing_consent?: Json | null
          fears?: Json | null
          life_goals?: Json | null
          life_lessons?: Json | null
          lifestyle_preferences?: Json | null
          skill_set?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hugo_user_progress: {
        Row: {
          domain: string
          growth_rate: number | null
          id: string
          metrics: Json
          milestones: Json | null
          progress_percentage: number | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          domain: string
          growth_rate?: number | null
          id?: string
          metrics: Json
          milestones?: Json | null
          progress_percentage?: number | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          domain?: string
          growth_rate?: number | null
          id?: string
          metrics?: Json
          milestones?: Json | null
          progress_percentage?: number | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      markdown_files: {
        Row: {
          content: string | null
          content_hash: string | null
          created_at: string | null
          filename: string
          id: string
          is_private: boolean | null
          last_cloud_modified: string | null
          last_local_modified: string | null
          oriva_id: string
          path: string
          sync_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          filename: string
          id?: string
          is_private?: boolean | null
          last_cloud_modified?: string | null
          last_local_modified?: string | null
          oriva_id: string
          path: string
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          filename?: string
          id?: string
          is_private?: boolean | null
          last_cloud_modified?: string | null
          last_local_modified?: string | null
          oriva_id?: string
          path?: string
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      markdown_sections: {
        Row: {
          content: string
          created_at: string | null
          entry_id: string
          file_id: string | null
          heading_level: number | null
          id: string
          last_response_at: string | null
          order_index: number
          parent_section_id: string | null
          response_count: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          entry_id: string
          file_id?: string | null
          heading_level?: number | null
          id?: string
          last_response_at?: string | null
          order_index: number
          parent_section_id?: string | null
          response_count?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          entry_id?: string
          file_id?: string | null
          heading_level?: number | null
          id?: string
          last_response_at?: string | null
          order_index?: number
          parent_section_id?: string | null
          response_count?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markdown_sections_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "markdown_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markdown_sections_parent_section_id_fkey"
            columns: ["parent_section_id"]
            isOneToOne: false
            referencedRelation: "markdown_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_apps: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          developer_id: string
          developer_name: string | null
          icon_url: string | null
          id: string
          install_count: number | null
          name: string
          oauth_redirect_uri: string | null
          permissions: Json | null
          pricing_config: Json | null
          pricing_model: string | null
          rating_average: number | null
          rating_count: number | null
          review_notes: string | null
          screenshots: Json | null
          slug: string
          status: string | null
          tagline: string | null
          updated_at: string | null
          version: string | null
          webhook_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          developer_id: string
          developer_name?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number | null
          name: string
          oauth_redirect_uri?: string | null
          permissions?: Json | null
          pricing_config?: Json | null
          pricing_model?: string | null
          rating_average?: number | null
          rating_count?: number | null
          review_notes?: string | null
          screenshots?: Json | null
          slug: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          version?: string | null
          webhook_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          developer_id?: string
          developer_name?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number | null
          name?: string
          oauth_redirect_uri?: string | null
          permissions?: Json | null
          pricing_config?: Json | null
          pricing_model?: string | null
          rating_average?: number | null
          rating_count?: number | null
          review_notes?: string | null
          screenshots?: Json | null
          slug?: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          version?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_apps_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          mentioned_user_id: string
          mentioner_user_id: string | null
          position_end: number
          position_start: number
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          mentioned_user_id: string
          mentioner_user_id?: string | null
          position_end: number
          position_start: number
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          mentioned_user_id?: string
          mentioner_user_id?: string | null
          position_end?: number
          position_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "mentions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      oauth_access_tokens: {
        Row: {
          app_id: string
          created_at: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          scopes: Json | null
          token: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          revoked_at?: string | null
          scopes?: Json | null
          token: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: Json | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_access_tokens_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_access_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorization_codes: {
        Row: {
          app_id: string
          code: string
          created_at: string | null
          expires_at: string
          id: string
          redirect_uri: string | null
          scopes: Json | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          app_id: string
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          redirect_uri?: string | null
          scopes?: Json | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          app_id?: string
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          redirect_uri?: string | null
          scopes?: Json | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorization_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      plugin_executions_log: {
        Row: {
          app_id: string | null
          created_at: string | null
          ended_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          session_id: string
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          app_id?: string | null
          created_at?: string | null
          ended_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          session_id: string
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          app_id?: string | null
          created_at?: string | null
          ended_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          session_id?: string
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plugin_executions_log_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "plugin_marketplace_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_installs: {
        Row: {
          config: Json
          id: string
          installed_at: string
          plugin_id: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          installed_at?: string
          plugin_id: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          installed_at?: string
          plugin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_installs_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_marketplace_apps: {
        Row: {
          category: string
          created_at: string
          description: string
          developer_id: string
          developer_name: string
          display_config: Json | null
          execution_url: string | null
          featured_order: number | null
          homepage: string | null
          hosting_type: string | null
          icon_url: string | null
          id: string
          iframe_options: Json | null
          install_count: number
          is_active: boolean
          is_featured: boolean
          name: string
          permissions: string[]
          pricing_config: Json | null
          pricing_model: string | null
          rating_average: number | null
          rating_count: number | null
          repository_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          sandbox_config: Json | null
          screenshots: string[] | null
          slug: string | null
          status: string
          submitted_at: string | null
          support_email: string
          tagline: string | null
          tags: string[] | null
          updated_at: string
          version: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          developer_id: string
          developer_name: string
          display_config?: Json | null
          execution_url?: string | null
          featured_order?: number | null
          homepage?: string | null
          hosting_type?: string | null
          icon_url?: string | null
          id?: string
          iframe_options?: Json | null
          install_count?: number
          is_active?: boolean
          is_featured?: boolean
          name: string
          permissions?: string[]
          pricing_config?: Json | null
          pricing_model?: string | null
          rating_average?: number | null
          rating_count?: number | null
          repository_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          sandbox_config?: Json | null
          screenshots?: string[] | null
          slug?: string | null
          status?: string
          submitted_at?: string | null
          support_email: string
          tagline?: string | null
          tags?: string[] | null
          updated_at?: string
          version?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          developer_id?: string
          developer_name?: string
          display_config?: Json | null
          execution_url?: string | null
          featured_order?: number | null
          homepage?: string | null
          hosting_type?: string | null
          icon_url?: string | null
          id?: string
          iframe_options?: Json | null
          install_count?: number
          is_active?: boolean
          is_featured?: boolean
          name?: string
          permissions?: string[]
          pricing_config?: Json | null
          pricing_model?: string | null
          rating_average?: number | null
          rating_count?: number | null
          repository_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          sandbox_config?: Json | null
          screenshots?: string[] | null
          slug?: string | null
          status?: string
          submitted_at?: string | null
          support_email?: string
          tagline?: string | null
          tags?: string[] | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      plugin_reviews: {
        Row: {
          created_at: string
          id: string
          plugin_id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plugin_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plugin_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_reviews_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_versions: {
        Row: {
          approved: boolean
          assets_url: string | null
          changelog: string | null
          created_at: string
          id: string
          manifest: Json
          plugin_id: string
          status: string | null
          version: string
        }
        Insert: {
          approved?: boolean
          assets_url?: string | null
          changelog?: string | null
          created_at?: string
          id?: string
          manifest?: Json
          plugin_id: string
          status?: string | null
          version: string
        }
        Update: {
          approved?: boolean
          assets_url?: string | null
          changelog?: string | null
          created_at?: string
          id?: string
          manifest?: Json
          plugin_id?: string
          status?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_versions_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          developer_id: string
          id: string
          latest_version: string | null
          metadata: Json
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          developer_id: string
          id?: string
          latest_version?: string | null
          metadata?: Json
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          developer_id?: string
          id?: string
          latest_version?: string | null
          metadata?: Json
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugins_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "plugin_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plugins_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: true
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_memberships: {
        Row: {
          group_id: string
          id: string
          is_active: boolean | null
          joined_at: string | null
          profile_id: string
          role: string | null
        }
        Insert: {
          group_id: string
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          profile_id: string
          role?: string | null
        }
        Update: {
          group_id?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          profile_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_social_links: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string | null
          platform: string
          profile_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          platform: string
          profile_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          platform?: string
          profile_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_social_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          is_anonymous: boolean | null
          is_default: boolean | null
          location: string | null
          updated_at: string | null
          username: string | null
          website_url: string | null
        }
        Insert: {
          account_id: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          is_default?: boolean | null
          location?: string | null
          updated_at?: string | null
          username?: string | null
          website_url?: string | null
        }
        Update: {
          account_id?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          is_default?: boolean | null
          location?: string | null
          updated_at?: string | null
          username?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      response_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_type: string
          response_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_type: string
          response_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_type?: string
          response_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "response_interactions_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "section_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      response_votes: {
        Row: {
          created_at: string | null
          id: string
          response_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          response_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          response_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_votes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          content: string | null
          created_at: string | null
          entry_id: string
          id: string
          is_anonymous: boolean
          parent_response_id: string | null
          profile_id: string | null
          response_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          entry_id: string
          id?: string
          is_anonymous?: boolean
          parent_response_id?: string | null
          profile_id?: string | null
          response_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          entry_id?: string
          id?: string
          is_anonymous?: boolean
          parent_response_id?: string | null
          profile_id?: string | null
          response_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "responses_parent_response_id_fkey"
            columns: ["parent_response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      section_responses: {
        Row: {
          applaud_count: number | null
          content: string
          created_at: string | null
          curation_count: number | null
          id: string
          is_pinned: boolean | null
          is_resolved: boolean | null
          last_activity_at: string | null
          parent_response_id: string | null
          quality_score: number | null
          relevance_score: number | null
          reply_count: number | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          section_entry_id: string | null
          tags: string[] | null
          thread_depth: number | null
          thread_path: string[] | null
          traction_score: number | null
          type: string
          updated_at: string | null
          user_id: string | null
          view_count: number | null
        }
        Insert: {
          applaud_count?: number | null
          content: string
          created_at?: string | null
          curation_count?: number | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          last_activity_at?: string | null
          parent_response_id?: string | null
          quality_score?: number | null
          relevance_score?: number | null
          reply_count?: number | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          section_entry_id?: string | null
          tags?: string[] | null
          thread_depth?: number | null
          thread_path?: string[] | null
          traction_score?: number | null
          type: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
        }
        Update: {
          applaud_count?: number | null
          content?: string
          created_at?: string | null
          curation_count?: number | null
          id?: string
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          last_activity_at?: string | null
          parent_response_id?: string | null
          quality_score?: number | null
          relevance_score?: number | null
          reply_count?: number | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          section_entry_id?: string | null
          tags?: string[] | null
          thread_depth?: number | null
          thread_path?: string[] | null
          traction_score?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "section_responses_parent_response_id_fkey"
            columns: ["parent_response_id"]
            isOneToOne: false
            referencedRelation: "section_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_responses_section_entry_id_fkey"
            columns: ["section_entry_id"]
            isOneToOne: false
            referencedRelation: "markdown_sections"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      session_metadata: {
        Row: {
          created_at: string | null
          effectiveness_rating: number | null
          focus_level: number | null
          id: string
          oriva_session_id: string
          productivity_notes: string | null
          updated_at: string | null
          work_type: string
        }
        Insert: {
          created_at?: string | null
          effectiveness_rating?: number | null
          focus_level?: number | null
          id?: string
          oriva_session_id: string
          productivity_notes?: string | null
          updated_at?: string | null
          work_type: string
        }
        Update: {
          created_at?: string | null
          effectiveness_rating?: number | null
          focus_level?: number | null
          id?: string
          oriva_session_id?: string
          productivity_notes?: string | null
          updated_at?: string | null
          work_type?: string
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_suggestor: boolean | null
          profile_id: string
          role: string | null
          session_id: string
          status: string | null
          user_id: string | null
          work_description: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_suggestor?: boolean | null
          profile_id: string
          role?: string | null
          session_id: string
          status?: string | null
          user_id?: string | null
          work_description?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_suggestor?: boolean | null
          profile_id?: string
          role?: string | null
          session_id?: string
          status?: string | null
          user_id?: string | null
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          error_message: string | null
          file_id: string | null
          id: string
          operation_type: string
          processing_time_ms: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          file_id?: string | null
          id?: string
          operation_type: string
          processing_time_ms?: number | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          file_id?: string | null
          id?: string
          operation_type?: string
          processing_time_ms?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "markdown_files"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          content: string
          created_at: string | null
          created_by: string | null
          due_date: string | null
          entry_id: string
          id: string
          position: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          entry_id: string
          id?: string
          position?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          entry_id?: string
          id?: string
          position?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      telescope_sessions: {
        Row: {
          collection_id: string | null
          created_at: string | null
          entries_viewed: number | null
          focus_entry_id: string | null
          id: string
          last_viewed_at: string | null
          navigation_path: Json | null
          preferences: Json | null
          scroll_position: number | null
          session_duration: number | null
          user_id: string
          view_mode: string | null
          zoom_level: number | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          entries_viewed?: number | null
          focus_entry_id?: string | null
          id?: string
          last_viewed_at?: string | null
          navigation_path?: Json | null
          preferences?: Json | null
          scroll_position?: number | null
          session_duration?: number | null
          user_id: string
          view_mode?: string | null
          zoom_level?: number | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          entries_viewed?: number | null
          focus_entry_id?: string | null
          id?: string
          last_viewed_at?: string | null
          navigation_path?: Json | null
          preferences?: Json | null
          scroll_position?: number | null
          session_duration?: number | null
          user_id?: string
          view_mode?: string | null
          zoom_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telescope_sessions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "content_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telescope_sessions_focus_entry_id_fkey"
            columns: ["focus_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telescope_sessions_focus_entry_id_fkey"
            columns: ["focus_entry_id"]
            isOneToOne: false
            referencedRelation: "entry_engagement"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      templates: {
        Row: {
          content: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          id: string
          label: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          created_at: string | null
          date: string
          focus_time_minutes: number
          id: string
          productivity_score: number
          session_id: string
          session_rating: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          focus_time_minutes: number
          id?: string
          productivity_score: number
          session_id: string
          session_rating: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          focus_time_minutes?: number
          id?: string
          productivity_score?: number
          session_id?: string
          session_rating?: number
          user_id?: string
        }
        Relationships: []
      }
      user_app_installs: {
        Row: {
          app_id: string
          app_settings: Json
          id: string
          installed_at: string | null
          is_active: boolean
          last_used_at: string | null
          permissions_granted: Json | null
          subscription_expires_at: string | null
          subscription_status: string | null
          user_id: string
        }
        Insert: {
          app_id: string
          app_settings?: Json
          id?: string
          installed_at?: string | null
          is_active?: boolean
          last_used_at?: string | null
          permissions_granted?: Json | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          user_id: string
        }
        Update: {
          app_id?: string
          app_settings?: Json
          id?: string
          installed_at?: string | null
          is_active?: boolean
          last_used_at?: string | null
          permissions_granted?: Json | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_app_installs_app"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "plugin_marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_app_installs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "plugin_marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_app_installs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contexts: {
        Row: {
          bio: string | null
          context: string
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          preferences: Json | null
          score: number | null
          traits: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          context: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          preferences?: Json | null
          score?: number | null
          traits?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          context?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          preferences?: Json | null
          score?: number | null
          traits?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_filter_presets: {
        Row: {
          created_at: string
          facets: Json
          id: string
          is_default: boolean
          name: string
          ranking: Json
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facets?: Json
          id?: string
          is_default?: boolean
          name: string
          ranking?: Json
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facets?: Json
          id?: string
          is_default?: boolean
          name?: string
          ranking?: Json
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personalization_cache: {
        Row: {
          cache_version: number | null
          cached_preferences: Json
          cached_topic_weights: Json
          created_at: string | null
          expires_at: string
          user_id: string
        }
        Insert: {
          cache_version?: number | null
          cached_preferences: Json
          cached_topic_weights: Json
          created_at?: string | null
          expires_at: string
          user_id: string
        }
        Update: {
          cache_version?: number | null
          cached_preferences?: Json
          cached_topic_weights?: Json
          created_at?: string | null
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personalization_preferences: {
        Row: {
          created_at: string | null
          default_time_window: string | null
          discoverability_mode: string | null
          diversity_factor: number | null
          hybrid_search_weight: number | null
          id: string
          learning_mode: string | null
          novelty_weight: number | null
          personalization_enabled: boolean | null
          privacy_mode: string | null
          quality_threshold: number | null
          semantic_search_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_time_window?: string | null
          discoverability_mode?: string | null
          diversity_factor?: number | null
          hybrid_search_weight?: number | null
          id?: string
          learning_mode?: string | null
          novelty_weight?: number | null
          personalization_enabled?: boolean | null
          privacy_mode?: string | null
          quality_threshold?: number | null
          semantic_search_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_time_window?: string | null
          discoverability_mode?: string | null
          diversity_factor?: number | null
          hybrid_search_weight?: number | null
          id?: string
          learning_mode?: string | null
          novelty_weight?: number | null
          personalization_enabled?: boolean | null
          privacy_mode?: string | null
          quality_threshold?: number | null
          semantic_search_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          allow_direct_messages: boolean | null
          auto_play_media: boolean | null
          created_at: string
          default_anonymous: boolean | null
          developer_mode: boolean | null
          email_notifications: boolean | null
          font_size: string
          group_activity_notifications: boolean | null
          group_visibility_settings: Json | null
          language: string
          mature_content: boolean | null
          mention_notifications: boolean | null
          notifications_enabled: boolean
          profile_visibility: string | null
          push_notifications: boolean | null
          response_notifications: boolean | null
          show_email: boolean | null
          show_location: boolean | null
          show_profile_in_groups: boolean | null
          theme: string
          themecrumbs_enabled: boolean | null
          themecrumbs_position: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_direct_messages?: boolean | null
          auto_play_media?: boolean | null
          created_at?: string
          default_anonymous?: boolean | null
          developer_mode?: boolean | null
          email_notifications?: boolean | null
          font_size?: string
          group_activity_notifications?: boolean | null
          group_visibility_settings?: Json | null
          language?: string
          mature_content?: boolean | null
          mention_notifications?: boolean | null
          notifications_enabled?: boolean
          profile_visibility?: string | null
          push_notifications?: boolean | null
          response_notifications?: boolean | null
          show_email?: boolean | null
          show_location?: boolean | null
          show_profile_in_groups?: boolean | null
          theme?: string
          themecrumbs_enabled?: boolean | null
          themecrumbs_position?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_direct_messages?: boolean | null
          auto_play_media?: boolean | null
          created_at?: string
          default_anonymous?: boolean | null
          developer_mode?: boolean | null
          email_notifications?: boolean | null
          font_size?: string
          group_activity_notifications?: boolean | null
          group_visibility_settings?: Json | null
          language?: string
          mature_content?: boolean | null
          mention_notifications?: boolean | null
          notifications_enabled?: boolean
          profile_visibility?: string | null
          push_notifications?: boolean | null
          response_notifications?: boolean | null
          show_email?: boolean | null
          show_location?: boolean | null
          show_profile_in_groups?: boolean | null
          theme?: string
          themecrumbs_enabled?: boolean | null
          themecrumbs_position?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_topic_engagements: {
        Row: {
          applaud_count: number
          created_at: string
          last_engaged_at: string
          publish_count: number
          response_count: number
          score: number
          topic_id: string
          topic_label: string
          topic_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applaud_count?: number
          created_at?: string
          last_engaged_at?: string
          publish_count?: number
          response_count?: number
          score?: number
          topic_id: string
          topic_label: string
          topic_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applaud_count?: number
          created_at?: string
          last_engaged_at?: string
          publish_count?: number
          response_count?: number
          score?: number
          topic_id?: string
          topic_label?: string
          topic_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_topic_intensities: {
        Row: {
          adjustment_source: string | null
          combined_intensity: number | null
          confidence_score: number | null
          created_at: string | null
          id: string
          last_manual_adjustment: string | null
          learned_intensity: number | null
          learning_sample_size: number | null
          manual_intensity: number | null
          negative_signals: number | null
          positive_signals: number | null
          topic_label: string
          topic_slug: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          adjustment_source?: string | null
          combined_intensity?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_manual_adjustment?: string | null
          learned_intensity?: number | null
          learning_sample_size?: number | null
          manual_intensity?: number | null
          negative_signals?: number | null
          positive_signals?: number | null
          topic_label: string
          topic_slug: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          adjustment_source?: string | null
          combined_intensity?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_manual_adjustment?: string | null
          learned_intensity?: number | null
          learning_sample_size?: number | null
          manual_intensity?: number | null
          negative_signals?: number | null
          positive_signals?: number | null
          topic_label?: string
          topic_slug?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          developer_mode: boolean | null
          display_name: string | null
          email: string
          entries_count: number | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          developer_mode?: boolean | null
          display_name?: string | null
          email: string
          entries_count?: number | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id: string
          preferences?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          developer_mode?: boolean | null
          display_name?: string | null
          email?: string
          entries_count?: number | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      work_appointments: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number
          effectiveness_rating: number | null
          focus_level: number | null
          host_user_id: string
          id: string
          is_private: boolean
          max_participants: number
          participants: Json | null
          productivity_notes: string | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string | null
          work_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          effectiveness_rating?: number | null
          focus_level?: number | null
          host_user_id: string
          id?: string
          is_private?: boolean
          max_participants?: number
          participants?: Json | null
          productivity_notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: string
          title: string
          updated_at?: string | null
          work_type?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          effectiveness_rating?: number | null
          focus_level?: number | null
          host_user_id?: string
          id?: string
          is_private?: boolean
          max_participants?: number
          participants?: Json | null
          productivity_notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: string
          title?: string
          updated_at?: string | null
          work_type?: string
        }
        Relationships: []
      }
      work_buddy_interaction_types: {
        Row: {
          data_schema: Json | null
          default_duration: number | null
          description: string
          is_schedulable: boolean | null
          requires_other_user: boolean | null
          type: string
        }
        Insert: {
          data_schema?: Json | null
          default_duration?: number | null
          description: string
          is_schedulable?: boolean | null
          requires_other_user?: boolean | null
          type: string
        }
        Update: {
          data_schema?: Json | null
          default_duration?: number | null
          description?: string
          is_schedulable?: boolean | null
          requires_other_user?: boolean | null
          type?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number
          effectiveness_rating: number | null
          focus_level: number | null
          host_user_id: string
          id: string
          is_private: boolean
          max_participants: number
          participants: Json | null
          productivity_notes: string | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          title: string
          updated_at: string | null
          work_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          effectiveness_rating?: number | null
          focus_level?: number | null
          host_user_id: string
          id?: string
          is_private?: boolean
          max_participants?: number
          participants?: Json | null
          productivity_notes?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          status?: string
          title: string
          updated_at?: string | null
          work_type?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          effectiveness_rating?: number | null
          focus_level?: number | null
          host_user_id?: string
          id?: string
          is_private?: boolean
          max_participants?: number
          participants?: Json | null
          productivity_notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: string
          title?: string
          updated_at?: string | null
          work_type?: string
        }
        Relationships: []
      }
      workbuddy_user_settings: {
        Row: {
          created_at: string | null
          default_session_duration: number | null
          focus_mode: string | null
          id: string
          notifications: boolean | null
          sound_effects: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_session_duration?: number | null
          focus_mode?: string | null
          id?: string
          notifications?: boolean | null
          sound_effects?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_session_duration?: number | null
          focus_mode?: string | null
          id?: string
          notifications?: boolean | null
          sound_effects?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      context_usage_stats: {
        Row: {
          active_users: number | null
          context: string | null
          interactions_24h: number | null
          interactions_30d: number | null
          interactions_7d: number | null
          total_interactions: number | null
        }
        Relationships: []
      }
      entry_engagement: {
        Row: {
          applaud_count: number | null
          bookmark_count: number | null
          created_at: string | null
          entry_id: string | null
          last_engaged_at: string | null
          popularity_score: number | null
          quality_score: number | null
          response_count: number | null
          score_updated_at: string | null
          share_count: number | null
          trending_score: number | null
          updated_at: string | null
          view_count: number | null
        }
        Relationships: []
      }
      user_context_summary: {
        Row: {
          bio: string | null
          context: string | null
          created_at: string | null
          interaction_count: number | null
          is_active: boolean | null
          last_interaction_at: string | null
          score: number | null
          user_id: string | null
        }
        Relationships: []
      }
      work_buddy_appointments: {
        Row: {
          appointment_status: string | null
          created_at: string | null
          data: Json | null
          id: string | null
          scheduled_at: string | null
          status: string | null
          target_user_email: string | null
          target_user_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: []
      }
      work_buddy_user_dashboard: {
        Row: {
          avg_focus_rating_month: number | null
          bio: string | null
          completed_appointments: number | null
          preferences: Json | null
          productivity_logs_week: number | null
          profile_updated_at: string | null
          score: number | null
          traits: Json | null
          upcoming_appointments: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _label_from_slug: {
        Args: { slug: string }
        Returns: string
      }
      add_group_member: {
        Args: { group_uuid: string; member_role?: string; user_uuid: string }
        Returns: boolean
      }
      approve_plugin_version_tx: {
        Args: {
          in_candidate_version: string
          in_plugin_id: string
          in_update_latest: boolean
          in_version_id: string
        }
        Returns: undefined
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      calculate_learned_intensity: {
        Args: { negative_count: number; positive_count: number }
        Returns: number
      }
      calculate_traction_score: {
        Args: { response_id_param: string }
        Returns: number
      }
      can_user_access_group: {
        Args: { group_id: string; user_id: string }
        Returns: boolean
      }
      clean_expired_personalization_cache: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_oauth_data: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_user_context: {
        Args: {
          p_bio?: string
          p_context: string
          p_preferences?: Json
          p_traits?: Json
          p_user_id: string
        }
        Returns: string
      }
      create_work_buddy_profile: {
        Args: {
          p_bio?: string
          p_collaboration_preferences?: Json
          p_user_id: string
          p_working_hours?: Json
        }
        Returns: string
      }
      debug_auth_state: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      decrement_install_count: {
        Args: { app_id_in: string }
        Returns: undefined
      }
      ensure_topic: {
        Args: { p_slug: string }
        Returns: string
      }
      exec_sql: {
        Args: { sql_query: string }
        Returns: string
      }
      extract_topics_from_content: {
        Args: { entry_content: Json; entry_title: string }
        Returns: string[]
      }
      find_similar_entries_by_id: {
        Args: {
          result_limit?: number
          similarity_threshold?: number
          source_entry_id: string
        }
        Returns: {
          content: Json
          created_at: string
          id: string
          similarity: number
          title: string
          topics: string[]
          user_id: string
        }[]
      }
      generate_oauth_credentials: {
        Args: { app_id_param: string }
        Returns: Json
      }
      get_app_context: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_developer_verification_values: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_entries_needing_embeddings: {
        Args: { batch_size?: number }
        Returns: {
          content: Json
          created_at: string
          id: string
          title: string
          updated_at: string
        }[]
      }
      get_group_member_count: {
        Args: { group_id: string }
        Returns: number
      }
      get_or_create_user_preferences: {
        Args: Record<PropertyKey, never>
        Returns: {
          allow_direct_messages: boolean | null
          auto_play_media: boolean | null
          created_at: string
          default_anonymous: boolean | null
          developer_mode: boolean | null
          email_notifications: boolean | null
          font_size: string
          group_activity_notifications: boolean | null
          group_visibility_settings: Json | null
          language: string
          mature_content: boolean | null
          mention_notifications: boolean | null
          notifications_enabled: boolean
          profile_visibility: string | null
          push_notifications: boolean | null
          response_notifications: boolean | null
          show_email: boolean | null
          show_location: boolean | null
          show_profile_in_groups: boolean | null
          theme: string
          themecrumbs_enabled: boolean | null
          themecrumbs_position: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
      }
      get_plugin_permission_values: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_plugin_status_values: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_response_thread: {
        Args: { max_depth?: number; section_entry_id_param: string }
        Returns: {
          applaud_count: number
          content: string
          created_at: string
          id: string
          parent_response_id: string
          relevance_score: number
          reply_count: number
          thread_depth: number
          type: string
          user_id: string
        }[]
      }
      get_review_rating_values: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_trending_apps: {
        Args: { app_limit?: number; days_back?: number }
        Returns: {
          app_id: string
          app_name: string
          install_growth: number
          recent_installs: number
        }[]
      }
      get_user_active_profiles: {
        Args: { user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_default: boolean
          profile_id: string
        }[]
      }
      get_user_default_profile: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_group_role: {
        Args: { group_id: string; user_id: string }
        Returns: string
      }
      get_user_topic_weights: {
        Args: { user_uuid: string }
        Returns: Json
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      hybrid_search: {
        Args: {
          keyword_weight?: number
          query_embedding?: string
          query_text: string
          result_limit?: number
          semantic_weight?: number
          similarity_threshold?: number
          topic_filter?: string[]
        }
        Returns: {
          content: Json
          created_at: string
          hybrid_score: number
          id: string
          keyword_score: number
          semantic_score: number
          title: string
          topics: string[]
          user_id: string
        }[]
      }
      increment_api_key_usage: {
        Args: { key_hash_param: string }
        Returns: undefined
      }
      increment_install_count: {
        Args: { app_id_in: string }
        Returns: undefined
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      log_context_interaction: {
        Args: {
          p_context: string
          p_data?: Json
          p_scheduled_at?: string
          p_target_user_id?: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      migrate_anon_entries: {
        Args: { p_dry_run?: boolean; p_entry_ids: string[] }
        Returns: {
          id: string
        }[]
      }
      migrate_existing_data_to_profiles: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      parse_content_headings: {
        Args: { content_text: string }
        Returns: Json
      }
      remove_group_member: {
        Args: { group_uuid: string; user_uuid: string }
        Returns: boolean
      }
      schedule_work_buddy_appointment: {
        Args: {
          p_appointment_data: Json
          p_scheduled_at: string
          p_target_user_id: string
          p_user_id: string
        }
        Returns: string
      }
      search_plugins: {
        Args: { category_filter?: string; q: string; status_filter?: string }
        Returns: {
          name: string
          plugin_id: string
          rank: number
          slug: string
          status: string
        }[]
      }
      semantic_similarity: {
        Args: {
          entry_id?: string
          query_embedding: string
          result_limit?: number
          similarity_threshold?: number
          topic_filter?: string[]
        }
        Returns: {
          content: Json
          created_at: string
          id: string
          similarity: number
          title: string
          topics: string[]
          user_id: string
        }[]
      }
      set_app_context: {
        Args: { context_name: string }
        Returns: undefined
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      update_collaboration_traits: {
        Args: {
          p_interaction_type: string
          p_rating?: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_entry_embedding: {
        Args: {
          combined_emb?: string
          content_emb?: string
          entry_id: string
          title_emb?: string
        }
        Returns: boolean
      }
      update_topic_engagements: {
        Args: { p_kind: string; p_topics: string[] }
        Returns: undefined
      }
      validate_oauth_token: {
        Args: { token_param: string }
        Returns: Json
      }
      validate_plugin_status_transition: {
        Args: {
          new_status: Database["public"]["Enums"]["plugin_status_enum"]
          old_status: Database["public"]["Enums"]["plugin_status_enum"]
        }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      agreement_status: "draft" | "active" | "expired" | "terminated"
      audience_type: "individual" | "group" | "organization"
      category_type_enum: "functional" | "industry" | "platform" | "audience"
      developer_verification_enum: "unverified" | "pending" | "verified"
      entry_status: "draft" | "published" | "archived"
      plugin_install_status_enum: "active" | "disabled" | "error" | "updating"
      plugin_permission_enum:
        | "read_entries"
        | "write_entries"
        | "read_profile"
        | "write_profile"
        | "read_contacts"
        | "write_contacts"
        | "network_access"
        | "storage_access"
        | "camera_access"
        | "location_access"
        | "admin_functions"
      plugin_status_enum:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "deprecated"
      review_rating_enum: "1" | "2" | "3" | "4" | "5"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agreement_status: ["draft", "active", "expired", "terminated"],
      audience_type: ["individual", "group", "organization"],
      category_type_enum: ["functional", "industry", "platform", "audience"],
      developer_verification_enum: ["unverified", "pending", "verified"],
      entry_status: ["draft", "published", "archived"],
      plugin_install_status_enum: ["active", "disabled", "error", "updating"],
      plugin_permission_enum: [
        "read_entries",
        "write_entries",
        "read_profile",
        "write_profile",
        "read_contacts",
        "write_contacts",
        "network_access",
        "storage_access",
        "camera_access",
        "location_access",
        "admin_functions",
      ],
      plugin_status_enum: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "deprecated",
      ],
      review_rating_enum: ["1", "2", "3", "4", "5"],
    },
  },
} as const
