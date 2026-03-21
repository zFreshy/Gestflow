import { supabase } from '../lib/supabase';

export const transactionService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async create(transaction) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async deleteMany(ids) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);
    
    if (error) throw error;
    return true;
  },

  async createMany(transactions) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactions)
      .select();
    
    if (error) throw error;
    return data;
  },

  async checkExistingBakeryIncome(userId, dates) {
    const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .eq('user_id', userId)
        .in('date', dates)
        .like('description', 'Lucro Padaria%');
        
    if (error) throw error;
    return data;
  },

  async finalizeRecurrence(userId, description, endDate) {
    // 1. Update all existing transactions with same description and type='expense'
    // to have active=false and end_date=endDate
    const { error } = await supabase
        .from('transactions')
        .update({ 
            active: false,
            end_date: endDate
        })
        .eq('user_id', userId)
        .eq('description', description)
        .eq('type', 'expense')
        .eq('expense_type', 'fixed');

    if (error) throw error;
    return true;
  },

  async reactivateRecurrence(userId, description) {
    // 1. Update all existing transactions with same description and type='expense'
    // to have active=true and end_date=null
    const { error } = await supabase
        .from('transactions')
        .update({ 
            active: true,
            end_date: null
        })
        .eq('user_id', userId)
        .eq('description', description)
        .eq('type', 'expense')
        .eq('expense_type', 'fixed');

    if (error) throw error;
    return true;
  }
};